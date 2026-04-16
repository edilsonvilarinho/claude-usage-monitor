# Plano: Indicador de Servidor Online via WebSocket

**Data criação:** 2026-04-16
**Hora criação:** 09:17:35
**Última atualização:** 2026-04-16 09:43:39
**Branch:** feature/server-online-indicator
**Status:** EM ANDAMENTO (v3 - Correção + Indicador Usuários)

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
| 8 | Commit + Push | ✅ Concluído | 2026-04-16 09:34:17 |

---

## Plano v3: Correção Pulse + Indicador Usuários Online

**Data:** 2026-04-16 09:40:00
**Status:** CONCLUÍDO

### PARTE 1: Correção Pulse Suave (v3a)

**Problema:** Indicador fica invisível quando status é `disconnected` (não existe CSS)

#### Animação CSS Implementada (Suave):

```css
@keyframes server-status-pulse {
  0%, 100% {
    opacity: 0.7;
    transform: scale(0.92);
    box-shadow: 0 0 4px var(--accent-color);
  }
  50% {
    opacity: 1;
    transform: scale(1);
    box-shadow: 0 0 8px var(--accent-color);
  }
}
```

#### Comportamento Visual:

| Status | Cor | Animação | Tooltip |
|--------|-----|----------|---------|
| `connected` | Verde | 3s, 0.92→1, 0.7→1 opacity | Server online (IP) |
| `disconnected` | Cinza | 3s, 0.92→1, 0.7→1 opacity | Servidor offline (IP) |
| `connecting` | Laranja | 2.5s (mais rápido) | Conectando... (IP) |
| `error` | Vermelho | 3s, 0.92→1, 0.7→1 opacity | Erro no servidor (IP) |

#### Etapas v3a:

| # | Descrição | Status | Data/Hora |
|---|-----------|--------|-----------|
| 1 | Atualizar `styles.css` - pulse suave + CSS vars | ✅ Concluído | 2026-04-16 09:44:00 |
| 2 | Garantir mapeamento `disconnected` → `server-status-disconnected` | ✅ Concluído | 2026-04-16 09:44:30 |
| 3 | Build + Testes | ✅ Concluído | 2026-04-16 09:46:48 |
| 4 | Commit + Push | 🔄 Pendente | - |

---

### PARTE 2: Indicador de Usuários Online (v3b)

**Objetivo:** Mostrar ícone de usuário + número de dispositivos conectados ao servidor

#### Arquitetura:

```
Server (Hono)
  ↓ WS /ws
  Mantém lista de clients conectados
  ↓ Broadcast periódico (a cada 10s)
  Envia { type: 'client_count', count: N }
  ↓
Electron Main (serverStatusService)
  Recebe mensagem WebSocket
  ↓ IPC 'server:client-count-changed'
Renderer (Header UI)
  Atualiza: [👤12]
```

#### Mensagens WebSocket:

```typescript
// Server → Client: contagem de clientes (a cada 10s)
{ type: 'client_count', count: number, timestamp: number }

// Server → Client: conexão estabelecida
{ type: 'connected', timestamp: number }
```

#### UI no Header:

```
[Sync] [●Server] [👤12]
           └── Indicador de usuários online
```

**Ícone:** Silhueta de pessoa (SVG inline)
**Número:** `12` (dispositivos conectados ao WebSocket)
**Estado offline:** `—` (travessão)

#### HTML proposto:

```html
<button class="icon-btn" id="btn-online-users" title="Online users" style="display:none">
  <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
    <path d="M6 6C7.65685 6 9 4.65685 9 3C9 1.34315 7.65685 0 6 0C4.34315 0 3 1.34315 3 3C3 4.65685 4.34315 6 6 6Z" fill="currentColor"/>
    <path d="M2 14C2 11.2386 4.23858 9 7 9H5C7.76142 9 10 11.2386 10 14V13C10 12.4477 9.55228 12 9 12H3C2.44772 12 2 12.4477 2 13V14Z" fill="currentColor"/>
  </svg>
  <span id="online-users-count">—</span>
</button>
```

#### Arquivos a modificar (v3b):

| Arquivo | Mudança |
|---------|---------|
| `server/src/routes/ws.ts` | Broadcast `client_count` a cada 10s |
| `src/services/serverStatusService.ts` | Receber `client_count`, expor via IPC |
| `src/main.ts` | Handler IPC `server:client-count-changed` |
| `src/preload.ts` | Expor `server.onClientCountChange()` |
| `src/renderer/index.html` | Adicionar botão `#btn-online-users` |
| `src/renderer/styles.css` | Estilos para `#btn-online-users` |
| `src/renderer/app.ts` | Listener para atualizar número |

#### Etapas v3b:

| # | Descrição | Status | Data/Hora |
|---|-----------|--------|-----------|
| 1 | Server: broadcast client_count a cada 10s | ✅ Concluído | 2026-04-16 09:44:00 |
| 2 | Client: receber client_count no WebSocket | ✅ Concluído | 2026-04-16 09:44:30 |
| 3 | Client: IPC handler + preload | ✅ Concluído | 2026-04-16 09:45:00 |
| 4 | Renderer: HTML + CSS do indicador | ✅ Concluído | 2026-04-16 09:45:30 |
| 5 | Renderer: conectar IPC e atualizar UI | ✅ Concluído | 2026-04-16 09:46:00 |
| 6 | Build + Testes | ✅ Concluído | 2026-04-16 09:46:48 |
| 7 | Commit + Push | 🔄 Pendente | - |

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
