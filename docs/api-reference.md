# Vagare API — Referência para o Frontend


http://localhost:3000
```

## Autenticação

Toda rota autenticada exige o header:

```
Authorization: Bearer <token>
```

O token é um JWT retornado por `/auth/register`, `/auth/login` ou `/auth/google`. Ele carrega `sub` (id do usuário), `email` e `sid` (id da sessão). O backend mantém uma sessão real no banco: `POST /auth/logout` destrói essa sessão, e o mesmo token para de funcionar imediatamente (não precisa esperar expirar). Sessões também expiram sozinhas conforme `JWT_EXPIRES_IN` (padrão 24h).

Erros de autenticação sempre respondem `401` com `{ "error": "<mensagem>" }`. Mensagens possíveis: `Token de autenticação ausente`, `Token inválido`, `Token expirado. Faça login novamente.`, `Sessão encerrada. Faça login novamente.`, `Usuário não encontrado`.

## Formato de erro (padrão em toda a API)

```json
{ "error": "mensagem legível em português" }
```

Sem corpo estruturado adicional (sem `code`, sem lista de campos). Trate pelo `status` HTTP + string de `error`.

---

## Auth

### POST /auth/register
Cadastro local.

**Body**
```json
{ "name": "Maria Silva", "email": "maria@example.com", "password": "senha123" }
```

**201**
```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": "uuid", "name": "Maria Silva", "email": "maria@example.com", "provider": "local" }
}
```

**Erros**: `400` (campo faltando ou senha < 6 caracteres), `409` (`E-mail já cadastrado`).

### POST /auth/login
**Body**: `{ "email": "...", "password": "..." }`
**200**: mesmo formato do register.
**Erros**: `400` (campo faltando), `401` (`Credenciais inválidas`, mensagem genérica tanto para e-mail inexistente quanto senha errada).

### POST /auth/google
**Body**: `{ "token": "<id_token do Google>" }`
**200**: mesmo formato do register (`provider: "google"`). Cria a conta automaticamente no primeiro login.
**Erros**: `400` (token ausente), `401` (`Token do Google inválido`).

### POST /auth/logout
Requer Bearer token. Destrói a sessão atual.
**204**, sem corpo.

---

## Perfil (`/users/me`) — todas exigem Bearer token

### GET /users/me
**200**
```json
{
  "id": "uuid",
  "name": "Maria Silva",
  "email": "maria@example.com",
  "provider": "local",
  "createdAt": "2026-09-01T23:47:47.788Z",
  "stats": { "totalTrips": 3 }
}
```

### PUT /users/me
Edita nome e/ou e-mail. Ambos os campos são opcionais (manda só o que quer mudar).
**Body**: `{ "name"?: string, "email"?: string }`
**200**: mesmo formato do GET.
**Erros**: `400` (nome ou e-mail vazio), `409` (`E-mail já cadastrado`, quando o e-mail já pertence a outra conta).

### DELETE /users/me
Exclui a conta e **todos os dados vinculados** (viagens, sessões) em cascata. Irreversível.
**204**, sem corpo.

---

## Viagens (`/trips`) — todas exigem Bearer token

Cada usuário só enxerga e manipula suas próprias viagens (isolamento total por `userId`; acessar viagem de outro usuário retorna `404`, nunca `403`, para não vazar existência do recurso).

### Modelo `Trip`
```ts
{
  id: string;
  userId: string;
  name: string;
  destination: string;
  startDate: string;       // ISO datetime, ex: "2026-09-01T00:00:00.000Z" (hora sempre 00:00:00Z)
  endDate: string;         // ISO datetime, mesmo formato
  budget: string | null;   // decimal serializado como string, ex: "1234.5"
  numberOfPeople: number | null;
  createdAt: string;       // ISO datetime
  updatedAt: string;       // ISO datetime
}
```

### POST /trips
**Body**
```json
{
  "name": "Férias em Florença",
  "destination": "Florença, Itália",
  "startDate": "2026-09-01",
  "endDate": "2026-09-10",
  "budget": 5000,
  "numberOfPeople": 2
}
```
`name`, `destination`, `startDate`, `endDate` são obrigatórios. `budget` e `numberOfPeople` são opcionais.
**201**: objeto `Trip`.
**Erros**: `400` — `Nome é obrigatório`, `Destino é obrigatório`, `Data de início é obrigatória`, `Data de término é obrigatória`, `Data de início/término inválida`, `A data de término deve ser igual ou posterior à data de início`.

### GET /trips
**200**: array de `Trip`, ordenado por `startDate` ascendente.

### GET /trips/:id
**200**: `Trip`. **404**: `{ "error": "Viagem não encontrada" }` se não existir ou for de outro usuário.

### PUT /trips/:id
Mesmo body do POST (substitui todos os campos). **200**: `Trip` atualizado. Mesmos erros de validação do POST + `404`.

### DELETE /trips/:id
**204**, sem corpo. Exclui a viagem e, em cascata, tudo vinculado a ela (atividades, gastos, informações — quando essas features existirem). **404** se não existir/não for do usuário.

---

## O que ainda não existe (em desenvolvimento)

Essas entidades já têm tabela no banco, mas **nenhuma rota HTTP ainda**:

- **Atividades do roteiro** (`Activity`): nome, data, horário, localização, vinculada a uma `Trip`.
- **Gastos/Orçamento** (`Expense`): descrição, valor, moeda, categoria, vinculado a uma `Trip`. Cálculo de saldo (`budget - soma dos gastos`) ainda não exposto por endpoint.
- **Informações da viagem** (`Info`): tipo (`flight` | `lodging` | `document`), título, descrição, data, `details` (JSON livre por tipo).

Não construa telas de frontend que dependam dessas rotas ainda — eu aviso quando estiverem prontas e atualizo este documento com o contrato exato (path, body, response).

## Ambiente local necessário para rodar o backend

```bash
docker compose up -d       # sobe o Postgres
npm run dev                 # sobe a API em http://localhost:3000
```
