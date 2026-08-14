# Validação manual — Trips (Insomnia)

## Importar

1. Abra o Insomnia → **Import/Export** → **Import Data** → **From File**
2. Selecione `insomnia/vagare-trips.json`

## Variáveis de ambiente

| Variável   | Valor inicial             | Como preencher                          |
|------------|---------------------------|-----------------------------------------|
| `base_url` | `http://localhost:3000`   | —                                       |
| `jwt`      | (vazio)                   | campo `token` do Register ou Login      |
| `trip_id`  | (vazio)                   | campo `id` da resposta de Create trip   |

## Passo a passo

1. Suba a API: `npm run dev`
2. **1. Register** → copie `token` → cole em `jwt`
3. (Opcional) **2. Login** com o mesmo e-mail/senha → atualize `jwt`
4. **3. Create trip** → espere **201** → copie `id` → cole em `trip_id`
5. **4. List trips** → espere **200** com a viagem na lista
6. **5. Get trip by id** → espere **200**
7. **6. Update trip** → espere **200** com nome `Toscana 2026`
8. **7. Delete trip** → espere **204** (sem body)

## Isolamento entre usuários

Para validar o 404 sem vazar existência: registre um segundo usuário, faça login (outro `jwt`) e chame Get/Update/Delete com o `trip_id` do primeiro. A API deve responder `{ "error": "Viagem não encontrada" }` com status **404**.
