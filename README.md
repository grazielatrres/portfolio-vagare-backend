# Vagare Backend

API do aplicativo **Vagare** (planejamento de viagens) — TCC de Engenharia de Software.

Stack: Node.js, Express, TypeScript, PostgreSQL, Prisma, JWT, Jest.

## Pré-requisitos

- Node.js 20+
- Docker (para o PostgreSQL) **ou** PostgreSQL local

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
cp .env.example .env
# Edite JWT_SECRET e, se necessário, DATABASE_URL / GOOGLE_CLIENT_ID

# 3. Subir o PostgreSQL
docker compose up -d

# 4. Aplicar migrations e gerar o Prisma Client
npx prisma migrate deploy
npx prisma generate

# 5. Rodar em desenvolvimento
npm run dev
```

API disponível em `http://localhost:3000`.

## Endpoints de autenticação

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/auth/register` | Cadastro local (nome, e-mail, senha) → JWT |
| `POST` | `/auth/login` | Login local (e-mail, senha) → JWT |
| `POST` | `/auth/google` | Login Google (`{ "token": "<id_token>" }`) → JWT |
| `GET` | `/health` | Health check |

## Endpoints de viagens (JWT obrigatório)

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/trips` | Cria viagem → 201 |
| `GET` | `/trips` | Lista viagens do usuário → 200 |
| `GET` | `/trips/:id` | Detalhe → 200 / 404 |
| `PUT` | `/trips/:id` | Edita viagem → 200 / 404 |
| `DELETE` | `/trips/:id` | Exclui viagem → 204 / 404 |

Collection Insomnia do fluxo completo: `insomnia/vagare-trips.json` (guia em `insomnia/README-trips.md`).

Exemplo de registro (Insomnia/curl):

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Maria","email":"maria@example.com","password":"senha123"}'
```

Rotas autenticadas futuras devem enviar:

```http
Authorization: Bearer <token>
```

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor com hot reload |
| `npm run build` | Compila TypeScript |
| `npm start` | Sobe o build de produção |
| `npm test` | Testes (Jest) |
| `npm run test:coverage` | Testes + cobertura (meta ≥ 75%) |
| `npm run lint` | ESLint + Prettier |

## Estrutura

```
src/
  controllers/   # HTTP
  services/      # Regras de negócio
  repositories/  # Acesso ao banco (Prisma)
  routes/
  middlewares/
  config/
  types/
```

Fluxo: **route → controller → service → repository → banco**.
