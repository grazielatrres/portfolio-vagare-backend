# Vagare Backend

API do aplicativo Vagare, um app de planejamento de viagens. TCC de Engenharia de Software.

Stack: Node.js, Express, TypeScript, PostgreSQL, Prisma, JWT, Jest.

CI/CD: lint, testes com cobertura mínima de 75% e análise de segurança (CodeQL) rodam em todo push/PR; o deploy é **automático na `main`**: a cada push/merge na `main`, o workflow **Deploy** roda lint, build e testes e, se passarem, gera a imagem e publica em produção sem intervenção. Na `develop` o deploy é **manual**: aba Actions → **Deploy** → `Run workflow`, escolhendo a branch `develop` (também dá para republicar a `main` assim). Só `main` e `develop` podem ser publicadas. A senha do Postgres de produção vem do secret `POSTGRES_PASSWORD` do repositório (mín. 20 caracteres, só `A-Z a-z 0-9 _ -`; gere com `openssl rand -hex 32`); sem ele o deploy falha.

## Pré-requisitos

- Node.js 20+
- Docker Desktop (para o PostgreSQL)

## Instalação

```bash
npm install
cp .env.example .env
```

Edite o arquivo `.env` e ajuste `JWT_SECRET` e, se necessário, `DATABASE_URL` e `GOOGLE_CLIENT_ID`.

## Banco de dados

Suba o Postgres com Docker:

```bash
docker compose up -d
```

Isso cria um container chamado `vagare-postgres` na porta 5432, com os dados persistidos em um volume Docker. Se a porta 5432 já estiver em uso por outro Postgres na sua máquina, pare o outro serviço ou altere a porta no `docker-compose.yml` e no `DATABASE_URL` do `.env`.

Aplique as migrations e gere o Prisma Client:

```bash
npx prisma migrate deploy
npx prisma generate
```

## Rodando o projeto

```bash
npm run dev
```

A API fica disponível em `http://localhost:3000`.

### Rodando o backend com Docker

Para subir banco e API juntos, sem precisar de Node instalado:

```bash
docker compose up -d --build
```

O container `vagare-api` aguarda o Postgres ficar saudável, aplica as migrations (`prisma migrate deploy`) e inicia o servidor em `http://localhost:3000`. As variáveis vêm do `.env`, exceto `DATABASE_URL`, que o compose sobrescreve para apontar para o serviço `postgres`. Após mudar o código, rode `docker compose up -d --build` de novo. Logs: `docker compose logs -f api`.

Para subir só o banco e rodar a API localmente com `npm run dev`: `docker compose up -d postgres`.

Para parar tudo: `docker compose down` (mantém os dados) ou `docker compose down -v` (apaga os dados).

## Scripts

| Script | Descrição |
|---|---|
| npm run dev | Servidor com hot reload |
| npm run build | Compila TypeScript |
| npm start | Sobe o build de produção |
| npm test | Testes (Jest) |
| npm run test:coverage | Testes com relatório de cobertura |
| npm run lint | ESLint e Prettier |
| npm run prisma:migrate | Cria e aplica uma nova migration |
| npm run prisma:studio | Interface visual do banco |

## Endpoints de autenticação

| Método | Rota | Descrição |
|---|---|---|
| POST | /auth/register | Cadastro local (nome, e-mail, senha) |
| POST | /auth/login | Login local (e-mail, senha) |
| POST | /auth/google | Login com Google (token do Google) |
| POST | /auth/refresh | Renova o token a partir do refresh token |
| POST | /auth/logout | Encerra a sessão do token atual |
| POST | /auth/forgot-password | Envia e-mail com link para redefinir a senha |
| POST | /auth/reset-password | Define nova senha a partir do token do e-mail |
| GET | /health | Health check |

Exemplo de cadastro (a senha precisa ter 8+ caracteres, com maiúscula, minúscula, número e caractere especial):

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Maria","email":"maria@example.com","password":"Senha@123"}'
```

Contrato completo de cada endpoint: [docs/api-reference.md](docs/api-reference.md).

Rotas autenticadas exigem o cabeçalho:

```
Authorization: Bearer <token>
```

## Endpoints de viagens

Todas exigem autenticação (JWT).

| Método | Rota | Descrição |
|---|---|---|
| POST | /trips | Cria viagem |
| GET | /trips | Lista viagens do usuário |
| GET | /trips/:id | Detalhe da viagem |
| PUT | /trips/:id | Edita viagem |
| DELETE | /trips/:id | Exclui viagem |

## Endpoints de perfil

Todas exigem autenticação (JWT).

| Método | Rota | Descrição |
|---|---|---|
| GET | /users/me | Dados do usuário autenticado e estatísticas |
| PUT | /users/me | Edita nome e/ou e-mail |
| DELETE | /users/me | Exclui a conta e todos os dados vinculados |

## Estrutura do projeto

```
src/
  controllers/   HTTP
  services/      regras de negócio
  repositories/  acesso ao banco (Prisma)
  routes/
  middlewares/
  config/
  types/
```

Fluxo de uma requisição: route, controller, service, repository, banco.
