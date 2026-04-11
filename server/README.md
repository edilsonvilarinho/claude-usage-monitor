# Claude Usage Monitor — Sync Server

Backend opcional para sincronizar dados de uso entre múltiplas máquinas.

## Stack

Node 20 + Hono + better-sqlite3 + Zod + jose (JWT)

## Auth flow

1. O cliente lê o `accessToken` OAuth do arquivo `~/.claude/.credentials.json` (mesmo token usado pelo app localmente).
2. O cliente envia `POST /auth/exchange` com `{ accessToken, deviceId, deviceLabel }`.
3. O servidor valida o token chamando `https://api.anthropic.com/api/oauth/profile` e extrai o e-mail da conta.
4. O servidor devolve um JWT próprio com validade de **24 horas**, assinado com `JWT_SECRET`.
5. O cliente usa esse JWT no header `Authorization: Bearer <jwt>` em todas as chamadas subsequentes.
6. O `deviceId` é um UUID v4 gerado pelo cliente na primeira habilitação e persistido localmente.

Nenhum cadastro separado é necessário — a identidade é o e-mail da conta Anthropic já autenticada.

## Endpoints

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| `GET` | `/health` | Não | Liveness check — retorna `{ status: "ok", ts: <unix ms> }` |
| `POST` | `/auth/exchange` | Não | Troca `accessToken` Anthropic por JWT próprio de 24h |
| `POST` | `/sync/push` | JWT | Envia dados locais para merge CRDT no servidor |
| `GET` | `/sync/pull?since=<ts>` | JWT | Retorna dados com `updated_at > since` (incremental) |
| `GET` | `/sync/snapshot` | JWT | Dump completo de todos os dados do usuário |
| `DELETE` | `/sync/account` | JWT | Apaga todos os dados do usuário (LGPD-friendly) |

### POST /auth/exchange

```json
// Request
{ "accessToken": "...", "deviceId": "uuid-v4", "deviceLabel": "Laptop Pessoal" }

// Response 200
{ "jwt": "eyJ...", "expiresAt": 1744329600000, "email": "usuario@example.com" }

// Response 401
{ "error": "unauthorized" }
```

### POST /sync/push

```json
// Request
{
  "deviceId": "uuid-v4",
  "daily": [{ "date": "2026-04-10", "maxWeekly": 80, "maxSession": 50, ... }],
  "sessionWindows": [{ "date": "2026-04-10", "resetsAt": "...", "resetsAtMinute": 28388640, "peak": 70, "updatedAt": 1744243200000 }],
  "timeSeries": [{ "ts": 1744243200000, "date": "2026-04-10", "session": 30, "weekly": 50 }],
  "usageSnapshots": [],
  "currentWindow": { "resetsAt": "...", "peak": 70, "updatedAt": 1744243200000 },
  "settings": { "theme": "dark", "lang": "pt-br", "updatedAt": 1744243200000 }
}

// Response 200
{ "accepted": true, "mergedAt": 1744243200000 }
```

### GET /sync/pull

```
GET /sync/pull?since=1744243200000
Authorization: Bearer <jwt>
```

Retorna todos os dados com `updated_at > since`. Use `since=0` para pull completo ou omita o parâmetro.

### GET /sync/snapshot

Equivale a `GET /sync/pull?since=0` — retorna todo o histórico sem filtro de cursor.

## Estratégia de merge CRDT

Todos os campos usam semântica **max-wins** ou **set-union**, garantindo convergência independente da ordem de push:

| Dado | Estratégia |
|------|-----------|
| `daily_snapshots` | Field-by-field `MAX()` por `(email, date)` |
| `session_windows` | `MAX(peak)` dedup por `(email, date, resets_at_minute)` |
| `time_series_points` | Append-only, `INSERT OR IGNORE` por `(email, ts)` |
| `usage_snapshots` | Append-only, `INSERT OR IGNORE` por `(email, ts)` |
| `currentWindow` / `settings` | Last-write-wins via `updatedAt` |

## Schema SQLite

```sql
users(email PK, created_at, last_seen_at)
devices(device_id PK, email FK, label, first_seen, last_seen)
daily_snapshots(email, date, max_weekly, max_session, max_credits,
                session_window_count, session_accum, updated_at, updated_by_device)
  PK: (email, date)
session_windows(email, date, resets_at_minute, resets_at_iso, peak, updated_at)
  PK: (email, date, resets_at_minute)
time_series_points(email, date, ts, session, weekly, credits)
  PK: (email, ts)  |  INDEX: (email, date)
usage_snapshots(email, ts, session, weekly)
  PK: (email, ts)
user_settings(email PK, payload JSON, updated_at)
sync_cursors(email, device_id, last_pulled_at)
  PK: (email, device_id)
```

## Variáveis de ambiente

| Var | Default | Descrição |
|-----|---------|-----------|
| `PORT` | `3030` | Porta HTTP |
| `DB_PATH` | `./data/sync.db` | Caminho do arquivo SQLite |
| `JWT_SECRET` | (gerado aleatório com warning) | Secret HMAC-SHA256 do JWT — **obrigatório em produção** |
| `CORS_ORIGIN` | `*` | Origin permitida pelo middleware CORS |

## Rodar localmente

```bash
# A partir da raiz do monorepo
npm run server:dev
# Servidor em http://localhost:3030

# Verificar saúde
curl http://localhost:3030/health
# {"status":"ok","ts":1744243200000}
```

## Buildar

```bash
npm run server:build
```

## Testes

```bash
# A partir da raiz do monorepo
npm run server:test

# Ou diretamente no workspace
cd server && npx vitest run
```

Os testes e2e usam `app.fetch()` in-process com SQLite `:memory:` e `validateAnthropicToken` mockado — sem porta TCP aberta, sem chamadas à API real.

## Deploy Fly.io

1. Instalar flyctl: https://fly.io/docs/hands-on/install-flyctl/
2. Login: `flyctl auth login`
3. Lançar (apenas na primeira vez — `fly.toml` já está configurado):
   ```bash
   cd server
   flyctl launch --no-deploy
   ```
4. Criar volume persistente para o SQLite:
   ```bash
   flyctl volumes create sync_data --region gru --size 1
   ```
5. Definir o secret do JWT:
   ```bash
   flyctl secrets set JWT_SECRET=$(openssl rand -hex 32)
   ```
6. Deploy:
   ```bash
   flyctl deploy
   ```
7. Verificar:
   ```bash
   flyctl logs
   curl https://<seu-app>.fly.dev/health
   ```

O `fly.toml` já contém a configuração de mount para `/data` onde o SQLite é armazenado.

## Deploy Docker

```bash
# Build da imagem
docker build -t claude-usage-sync .

# Rodar com volume persistente
docker run -p 3030:3030 \
  -v $(pwd)/data:/app/data \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  claude-usage-sync

# Verificar
curl http://localhost:3030/health
```

O `Dockerfile` usa build multi-stage: compila o TypeScript em um estágio e copia apenas o output para a imagem de runtime Node 20 slim, incluindo o binário nativo do `better-sqlite3`.

## Troubleshooting

**JWT expirado** — o cliente recebe `401 { "error": "unauthorized" }` e deve refazer o `/auth/exchange` automaticamente. O `syncService` do cliente trata isso no ciclo de retry.

**Token Anthropic inválido** — o `/auth/exchange` retorna `401`. Verifique se o arquivo `~/.claude/.credentials.json` existe e se a sessão Claude CLI está ativa.

**CORS bloqueando** — configure a variável `CORS_ORIGIN` com a origin correta (para Electron local não é necessário; relevante apenas se usar via browser).

**SQLite locked** — em deploy com múltiplas instâncias, o SQLite com WAL suporta leituras concorrentes, mas apenas uma escrita por vez. Para alto volume, migre para PostgreSQL (substitua `better-sqlite3` por `pg` e ajuste as queries).

**`better-sqlite3` crash após update do Node** — o binding nativo precisa ser recompilado: `npm rebuild better-sqlite3`.

**Volume cheio no Fly.io** — verifique com `flyctl ssh console` e `df -h /data`. Aumente o volume com `flyctl volumes extend <volume-id> --size <gb>`.
