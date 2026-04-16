# Plano: Indicador de Servidor Online via WebSocket

**Data criação:** 2026-04-16
**Hora criação:** 09:17:35
**Última atualização:** 2026-04-16 09:18:35
**Branch:** feature/server-online-indicator
**Status:** EM ANDAMENTO

---

## Objetivo

Adicionar um indicador visual no header da aplicação que mostra se o servidor de sync está online ou offline. A comunicação é feita via WebSocket para detecção em tempo real.

---

## IP do Servidor (hardcoded por enquanto)

```
http://104.131.23.0:3030
```

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│  Server (Hono + ws)                                        │
│  ────────────────────────────────────────                  │
│  WS /ws → conexão persistente                              │
│                    ↓                                       │
│  Electron Main Process                                     │
│  ────────────────────────                                  │
│  WebSocket client → conecta a 104.131.23.0:3030/ws        │
│  Reconexão automática                                      │
│  IPC → envia status para renderer                          │
│                    ↓                                       │
│  Renderer (Header UI)                                     │
│  ────────────────────────────                              │
│  Ícone verde = online, cinza = offline                     │
└─────────────────────────────────────────────────────────────┘
```

---

## WebSocket Messages

```typescript
// Server → Client: ping periódico (a cada 30s)
{ type: 'ping', timestamp: number }

// Client → Server: pong (heartbeat)
{ type: 'pong' }
```

---

## Etapas de Implementação

| # | Descrição | Status | Data/Hora |
|---|-----------|--------|-----------|
| 1 | Criar branch feature/server-online-indicator | ✅ Concluído | 2026-04-16 09:17:35 |
| 2 | Criar plano em minimax-planos/ | ✅ Concluído | 2026-04-16 09:17:40 |
| 3 | Server: instalar deps (ws) | ✅ Concluído | 2026-04-16 09:18:00 |
| 4 | Server: criar routes/ws.ts | ✅ Concluído | 2026-04-16 09:18:10 |
| 5 | Server: modificar index.ts | ✅ Concluído | 2026-04-16 09:18:15 |
| 6 | Client: criar serverStatusService.ts | ✅ Concluído | 2026-04-16 09:18:20 |
| 7 | Client: IPC handlers em main.ts | ✅ Concluído | 2026-04-16 09:18:25 |
| 8 | Renderer: indicador no header (index.html) | ✅ Concluído | 2026-04-16 09:18:30 |
| 9 | Renderer: estilos (styles.css) | ✅ Concluído | 2026-04-16 09:18:32 |
| 10 | Renderer: preload.ts - adicionar interface server | ✅ Concluído | 2026-04-16 09:18:33 |
| 11 | Renderer: app.ts - conectar IPC e UI | ✅ Concluído | 2026-04-16 09:18:35 |
| 12 | Testar manualmente | 🔄 Pendente | - |
| 13 | Commit | 🔄 Pendente | - |
| 14 | Push | 🔄 Pendente | - |

---

## Arquivos a criar/modificar

| Arquivo | Status |
|---------|--------|
| `server/package.json` | ✅ Modificado - adicionado ws, @types/ws |
| `server/src/routes/ws.ts` | ✅ Criado - WebSocket handler com heartbeat |
| `server/src/index.ts` | ✅ Modificado - integra WebSocket via 'upgrade' event |
| `src/services/serverStatusService.ts` | ✅ Criado - WebSocket client com reconexão |
| `src/main.ts` | ✅ Modificado - IPC handlers + connect on startup |
| `src/preload.ts` | ✅ Modificado - expõe server.getStatus, server.onStatusChange |
| `src/renderer/index.html` | ✅ Modificado - botão #btn-server-status |
| `src/renderer/styles.css` | ✅ Modificado - estilos .server-status-* |
| `src/renderer/app.ts` | ✅ Modificado - listener para server:status-changed |

---

## Detalhes técnicos

**Reconexão WebSocket:** Exponential backoff (1s, 2s, 4s, 8s... max 30s)

**UI do indicador:**
- Botão no header (ao lado do sync)
- 🟢 Verde = online (classe: server-status-online)
- ⚫ Cinza = offline (classe: server-status-offline)
- 🟡 Amarelo = conectando (classe: server-status-connecting)
- 🔴 Vermelho = error (classe: server-status-error)

**Nota:** @hono/websocket não existe no npm. Usamos `ws` nativo com upgrade manual via 'upgrade' event.

**Mensagem de commit:**
```
feat: adicionar indicador de servidor online via WebSocket
```
