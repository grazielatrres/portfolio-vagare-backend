#!/usr/bin/env bash
# Roda DENTRO da EC2, enviado pelo deploy.yml via AWS Systems Manager (SSM Run
# Command). Não há SSH: o agente do SSM na instância busca o comando na AWS.
#
# Recebe por variável de ambiente só dados não sensíveis (APP_DIR, IMAGE_TAG,
# GH_ACTOR, AWS_REGION). Os segredos são lidos do Parameter Store (SecureString)
# com a role da instância, para não ficarem no histórico de comandos do SSM.
set -euo pipefail

: "${APP_DIR:?}" "${IMAGE_TAG:?}" "${GH_ACTOR:?}" "${AWS_REGION:?}"

# O SSM roda como root sem HOME; o docker login precisa dele para o config.json.
export HOME=/root

param() {
  aws ssm get-parameter --region "$AWS_REGION" --name "/vagare/prod/$1" \
    --with-decryption --query Parameter.Value --output text
}

POSTGRES_PASSWORD=$(param POSTGRES_PASSWORD)
# "-" = secret SENTRY_DSN não definido no GitHub (o Parameter Store não aceita
# valor vazio). Vazio = Sentry desligado.
SENTRY_DSN=$(param SENTRY_DSN)
if [[ "$SENTRY_DSN" == "-" ]]; then SENTRY_DSN=""; fi

# Usados pelo docker-compose.prod.yml: imagem deste commit, senha do banco e DSN.
export IMAGE_TAG POSTGRES_PASSWORD SENTRY_DSN

param GHCR_TOKEN | docker login ghcr.io -u "$GH_ACTOR" --password-stdin

cd "$APP_DIR"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# O Postgres só aplica POSTGRES_PASSWORD na primeira criação do volume. Se o
# volume foi criado com outra senha, a API falha ao autenticar. Este comando
# alinha a senha do volume com a do secret a cada deploy (o acesso local no
# container não pede senha, e rodar de novo não causa problema). O SQL vai pelo
# stdin (printf é builtin), então a senha não aparece na lista de processos; o
# formato dela já foi validado no runner.
printf "ALTER USER postgres WITH PASSWORD '%s';\n" "$POSTGRES_PASSWORD" \
  | docker compose -f docker-compose.prod.yml exec -T postgres \
      psql -U postgres -v ON_ERROR_STOP=1 -q
docker compose -f docker-compose.prod.yml restart api

docker image prune -f

# Confere se a API subiu antes de dar o deploy como concluído.
PORT=$(grep -E '^PORT=' .env | cut -d= -f2 | tr -d '"' || true)
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:${PORT:-3000}/health/ready" > /dev/null; then
    echo "API e banco respondendo em /health/ready"
    exit 0
  fi
  sleep 2
done
echo "A API não respondeu em /health/ready após 60s. Últimos logs:"
docker compose -f docker-compose.prod.yml logs --tail 50 api
exit 1
