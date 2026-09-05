# Vagare Backend

API do aplicativo Vagare, um app de planejamento de viagens. TCC de Engenharia de Software.

Stack: Node.js, Express, TypeScript, PostgreSQL, Prisma, JWT, Jest.

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

Para parar o banco: `docker compose down` (mantém os dados) ou `docker compose down -v` (apaga os dados).

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
| POST | /auth/logout | Encerra a sessão do token atual |
| GET | /health | Health check |

Exemplo de cadastro:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Maria","email":"maria@example.com","password":"senha123"}'
```

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

Collections do Insomnia:

- Viagens: `insomnia/vagare-trips.json` (guia em `insomnia/README-trips.md`)
- Perfil e logout: `insomnia/vagare-profile.json` (guia em `insomnia/README-profile.md`)

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
