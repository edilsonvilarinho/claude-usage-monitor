# Plano: Indicador de Servidor Online via WebSocket

**Data criação:** 2026-04-16
**Hora criação:** 09:17:35
**Última atualização:** 2026-04-16 09:33:07
**Branch:** feature/server-online-indicator
**Status:** CONCLUÍDO (v1 + v2 melhorias)

---

## Plano de Melhoria v2: Indicador Server Status Aprimorado

**Data:** 2026-04-16 09:25:00
**Status:** CONCLUÍDO

### Melhorias Propostas

1. **Suporte i18n** - Tooltip respeitando idioma configurado (PT-BR / EN)
2. **Animação "Respiração"** - Offline/Error com bolinha vermelha pulsante
3. **Tooltip com IP** - Mostra status + IP do servidor

### Tooltip proposto:

| Status | Tooltip PT-BR | Tooltip EN |
|--------|---------------|------------|
| Online | `Servidor online (104.131.23.0:3030)` | `Server online (104.131.23.0:3030)` |
| Offline | `Servidor offline (104.131.23.0:3030)` | `Server offline (104.131.23.0:3030)` |
| Connecting | `Conectando... (104.131.23.0:3030)` | `Connecting... (104.131.23.0:3030)` |
| Error | `Erro no servidor (104.131.23.0:3030)` | `Server error (104.131.23.0:3030)` |

### Animação CSS (server-status-breathe):

```css
@keyframes server-status-breathe {
  0%, 100% {
    opacity: 0.4;
    transform: scale(0.85);
    box-shadow: 0 0 4px var(--accent-red);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.0);
    box-shadow: 0 0 12px var(--accent-red);
  }
}
```

### Etapas v2:

| # | Descrição | Status | Data/Hora |
|---|-----------|--------|-----------|
| 1 | Atualizar plano com v2 | ✅ Concluído | 2026-04-16 09:30:29 |
| 2 | Adicionar chaves i18n em app.ts (translations) | ✅ Concluído | 2026-04-16 09:31:00 |
| 3 | Atualizar updateServerStatusUI() para tooltip dinâmico + IP | ✅ Concluído | 2026-04-16 09:31:30 |
| 4 | Adicionar animação server-status-breathe em styles.css | ✅ Concluído | 2026-04-16 09:32:00 |
| 5 | server-status-offline/error → vermelho + animação | ✅ Concluído | 2026-04-16 09:32:30 |
| 6 | Garantir que indicador sempre apareça | ✅ Concluído | 2026-04-16 09:33:00 |
| 7 | Testar (build) | ✅ Concluído | 2026-04-16 09:33:07 |
| 8 | Commit + Push | 🔄 Pendente | - |

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
| 12 | Testar manualmente | ✅ Concluído | 2026-04-16 09:20:06 |
| 13 | Commit | ✅ Concluído | 2026-04-16 09:20:10 |
| 14 | Push | ✅ Concluído | 2026-04-16 09:20:12 |

---

## Arquivos a criar/modificar

| Arquivo | Status v1 | Status v2 |
|---------|-----------|-----------|
| `server/package.json` | ✅ Criado/Modificado | - |
| `server/src/routes/ws.ts` | ✅ Criado | - |
| `server/src/index.ts` | ✅ Modificado | - |
| `src/services/serverStatusService.ts` | ✅ Criado | - |
| `src/main.ts` | ✅ Modificado | - |
| `src/preload.ts` | ✅ Modificado | - |
| `src/renderer/index.html` | ✅ Modificado | - |
| `src/renderer/styles.css` | ✅ Modificado | ✅ Modificado - adicionado breathe animation |
| `src/renderer/app.ts` | ✅ Modificado | ✅ Modificado - i18n + tooltip dinâmico |
| `minimax-planos/server-online-indicator.md` | ✅ Criado | ✅ Atualizado |

---

## Detalhes técnicos

**Reconexão WebSocket:** Exponential backoff (1s, 2s, 4s, 8s... max 30s)

**UI do indicador:**
- Botão no header (ao lado do sync) - sempre visível
- 🟢 Verde = online (classe: server-status-online) - glow verde
- 🔴 Vermelho respirando = offline (classe: server-status-offline) - animação breathe
- 🟡 Amarelo = conectando (classe: server-status-connecting) - animação pulse
- 🔴 Vermelho respirando = error (classe: server-status-error) - animação breathe

**Tooltip:** `[Status traduzido] (104.131.23.0:3030)`

**Nota:** @hono/websocket não existe no npm. Usamos `ws` nativo com upgrade manual via 'upgrade' event.

**Mensagem de commit:**
```
feat: adicionar indicador de servidor online via WebSocket
```
