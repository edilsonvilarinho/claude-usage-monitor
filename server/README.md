# Claude Usage Monitor — Sync Server

Backend Hono para sincronização opcional entre dispositivos.

## Status

Fase 1 — boilerplate. Apenas `/health` funcional.
Fase 2 implementará: auth, SQLite, push/pull.

## Desenvolvimento local

```bash
# Na raiz do monorepo
npm run server:dev
# Servidor em http://localhost:3030

curl http://localhost:3030/health
# {"status":"ok","ts":...}
```

## Build

```bash
npm run server:build
```

## Deploy (Fly.io) — Fase 2

```bash
# Instalar flyctl: https://fly.io/docs/hands-on/install-flyctl/

# Login
flyctl auth login

# Lançar (apenas primeira vez — já existe fly.toml)
cd server
flyctl launch --no-deploy

# Criar volume SQLite persistente
flyctl volumes create sqlite_data --region gru --size 1

# Definir segredos
flyctl secrets set JWT_SECRET=$(openssl rand -base64 32)

# Deploy
flyctl deploy

# Verificar
curl https://sync-claude-usage.fly.dev/health
```

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta HTTP | `3030` |
| `NODE_ENV` | Ambiente | `development` |
| `JWT_SECRET` | Segredo para assinar JWTs | obrigatório em prod |
| `DATABASE_PATH` | Caminho do arquivo SQLite | `/data/sync.db` |
