# Arquitetura e Fluxo Interno — Claude Usage Monitor

Este documento descreve o fluxo completo da aplicação: como os serviços se comunicam, como os dados trafegam do processo principal para o renderer, e as regras de comportamento de cada componente.

---

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PROCESSO PRINCIPAL (main.ts)               │
│                                                                     │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐   │
│  │CredentialSvc │───▶│  UsageApiService│───▶│  PollingService  │   │
│  │              │    │                 │    │  (EventEmitter)  │   │
│  │ Lê e renova  │    │ GET /api/oauth/ │    │                  │   │
│  │ token OAuth  │    │ usage           │    │ Normal: 7 min    │   │
│  └──────────────┘    └─────────────────┘    │ Rápido: 5 min    │   │
│                                             │ Ocioso: 20 min   │   │
│                                             └────────┬─────────┘   │
│                                                      │             │
│            ┌─────────────────────────────────────────┤             │
│            │ eventos: usage-updated / rate-limited / error         │
│            ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                       main.ts (orquestrador)                │   │
│  │                                                             │   │
│  │  ┌────────────────┐  ┌─────────────────┐  ┌─────────────┐  │   │
│  │  │NotificationSvc │  │  SettingsService│  │UpdateService│  │   │
│  │  │ Toast nativo   │  │  electron-store │  │ GitHub API  │  │   │
│  │  │ Debounce 50%   │  │  APPDATA/config │  │ 1x por dia  │  │   │
│  │  └────────────────┘  └─────────────────┘  └─────────────┘  │   │
│  │                                                             │   │
│  │  ┌────────────────┐  ┌─────────────────┐                   │   │
│  │  │  Tray (ícone)  │  │  Popup Window   │                   │   │
│  │  │  Canvas PNG    │  │  BrowserWindow  │                   │   │
│  │  │  via IPC       │  │  frame: false   │                   │   │
│  │  └────────────────┘  └────────┬────────┘                   │   │
│  └────────────────────────────────┼────────────────────────────┘   │
└───────────────────────────────────┼────────────────────────────────┘
                                    │ IPC (contextBridge)
┌───────────────────────────────────▼────────────────────────────────┐
│                        RENDERER (app.ts + preload.ts)              │
│                                                                     │
│  Chart.js (doughnut 180°)  ·  Canvas tray icon  ·  UI settings    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Dados Passo a Passo

### 1. Inicialização (`app.whenReady`)

```
app.whenReady()
  │
  ├─ registerIpcHandlers()          ← registra todos os canais IPC
  ├─ Restaura rate limit do disco   ← pollingService.restoreRateLimit(until, count)
  ├─ Sincroniza HKCU\Run            ← corrige divergência entre config e registro
  ├─ createTray()                   ← ícone inicial vazio, aguarda canvas do renderer
  ├─ createPopup()                  ← BrowserWindow oculto, carrega index.html
  ├─ pollingService.start()         ← dispara primeiro poll imediatamente
  └─ setTimeout(runUpdateCheck, 5s) ← verifica atualizações após 5s
```

### 2. Ciclo de Polling (`PollingService`)

```
poll()
  │
  ├─ [rate limited?] → agenda próximo poll para quando o cooldown expirar
  │
  ├─ fetchUsageData()
  │     │
  │     └─ getAccessToken() → lê ~/.claude/.credentials.json
  │           ├─ Token válido? → retorna access_token
  │           └─ Token expirando (<5min)? → POST /v1/oauth/token (refresh)
  │                 └─ atualiza e grava .credentials.json
  │
  ├─ [sucesso]
  │     ├─ Detecta spike >1% → ativa fastCyclesLeft = 2 (poll a cada 5 min)
  │     ├─ emit('usage-updated', data)
  │     └─ agenda próximo poll
  │           ├─ errorCount > 0 → backoff exponencial (base 1min, máx 20min)
  │           ├─ sistema ocioso (>10min idle) → 20 min
  │           ├─ fastCyclesLeft > 0 → 5 min
  │           └─ normal → 7 min
  │
  └─ [erro 429 — Rate Limit]
        ├─ rateLimitCount++
        ├─ Calcula waitMs:
        │     ├─ Header X-RateLimit-Reset → usa timestamp exato da API
        │     ├─ Header Retry-After → usa segundos fornecidos pela API
        │     └─ Sem hint → backoff exponencial: 5m · 2^(count-1), máx 60min
        ├─ emit('rate-limited', until, count, resetAt)
        └─ persiste no disco (sobrevive reinicialização)
```

### 3. Propagação de Eventos para o Renderer

```
PollingService.emit('usage-updated', data)
  │
  └─ main.ts (listener)
        ├─ lastUsageData = data
        ├─ updateTrayTooltip(data)    ← tooltip com % sessão + semanal + versão
        ├─ checkAndNotify(data)       ← NotificationService (debounce 50%)
        └─ popup.webContents.send('usage-updated', data)
              └─ renderer/app.ts
                    ├─ Atualiza medidores Chart.js (sessão + semanal)
                    ├─ Atualiza barras Sonnet e créditos extras
                    ├─ Desenha ícone da bandeja em <canvas> oculto
                    └─ ipcRenderer.send('tray-icon-data', dataUrl)
                          └─ main.ts → tray.setImage(nativeImage)

PollingService.emit('rate-limited', until, count, resetAt)
  │
  └─ main.ts
        ├─ persiste {rateLimitedUntil, rateLimitCount, rateLimitResetAt} no disco
        └─ popup.webContents.send('rate-limited', until, resetAt)
              └─ renderer exibe banner de contagem regressiva

PollingService.emit('error', err)
  │
  └─ main.ts
        ├─ [erro de credencial] → abre popup + send('credential-missing', path)
        └─ [outro erro] → send('usage-error', message) se popup visível
```

---

## Serviços — Responsabilidades Detalhadas

### `credentialService.ts`
| Responsabilidade | Detalhe |
|---|---|
| Localizar credenciais | Busca em `%USERPROFILE%\.claude\.credentials.json` e em todos os caminhos WSL (`\\wsl.localhost\<distro>\home\<user>\.claude\`) |
| Selecionar arquivo | Usa o arquivo com `mtime` mais recente quando há múltiplos candidatos |
| Refresh de token | POST para `console.anthropic.com/v1/oauth/token` quando `expiresAt - now < 5min` |
| Persistência | Grava o token renovado de volta no `.credentials.json` |
| Falha de refresh | Se o refresh falhar, usa o token existente (não quebra o app) |

### `usageApiService.ts`
| Responsabilidade | Detalhe |
|---|---|
| Endpoint | `GET https://api.anthropic.com/api/oauth/usage` |
| Header obrigatório | `anthropic-beta: oauth-2025-04-20` |
| Retry | Apenas em erros 5xx (até 3 tentativas com delay exponencial) |
| Rate limit (429) | Não retenta — lança imediatamente `{ isRateLimit: true, retryAfterMs, resetAt }` |
| Timeout | 10 segundos por requisição |

### `pollingService.ts`
| Estado | Intervalo |
|---|---|
| Normal | 7 minutos |
| Spike detectado (>1%) | 5 minutos por 2 ciclos |
| Sistema ocioso (>10 min) | 20 minutos |
| Erro genérico | Backoff: 1min · 2^(errorCount-1), máx 20 min |
| Rate limited | Respeita hint da API; sem hint: 5min · 2^(count-1), máx 60 min |
| `triggerNow()` | No-op se ainda rate limited; caso contrário, dispara poll imediato |
| `forceNow()` | Sempre dispara poll (ignora rate limit — para uso interno) |

### `settingsService.ts`
- Usa `electron-store` para persistência
- **Dev:** `%APPDATA%\Electron\config.json`
- **Prod:** `%APPDATA%\Claude Usage Monitor\config.json`
- Campos persistidos: `launchAtStartup`, `alwaysVisible`, `language`, `theme`, `windowSize`, `notificationThreshold`, `notifyOnReset`, `soundEnabled`, `rateLimitedUntil`, `rateLimitCount`, `rateLimitResetAt`, `lastUpdateCheck`
- **Regra crítica:** nunca restringir `minimum`/`maximum` de campos existentes sem migration — causa crash na inicialização

### `notificationService.ts`
- Emite toast nativo do Windows via `Notification` API do Electron
- Debounce: não renotifica até o uso cair abaixo de 50% e cruzar o limiar novamente
- `syncWindowState(data)` — atualiza estado interno sem emitir notificação (usado após refresh manual)
- `sendTestNotification()` — dispara toast de teste independente do estado atual

### `startupService.ts`
- Registra/remove entrada no `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
- Sincronizado na inicialização: se o valor no registro diverge da configuração salva, corrige automaticamente

### `updateService.ts`
- Consulta `api.github.com/repos/edilsonvilarinho/claude-usage-monitor/releases/latest`
- Comparação semântica de versão (major.minor.patch)
- Verificação automática: 1x por dia (baseado em `lastUpdateCheck` persistido)
- Falha silenciosa: erros de rede não interrompem o app
- Timeout: 10 segundos

---

## Camada IPC — Canais Disponíveis

### Main → Renderer (`webContents.send`)
| Canal | Payload | Quando |
|---|---|---|
| `usage-updated` | `UsageData` | Após cada poll bem-sucedido |
| `rate-limited` | `(until: number, resetAt?: number)` | Ao receber 429 da API |
| `usage-error` | `string` | Erro genérico de polling (popup visível) |
| `credential-missing` | `string` (caminho esperado) | Credencial não encontrada |
| `update-available` | `{ version, url }` | Nova versão detectada no GitHub |

### Renderer → Main (`ipcRenderer.invoke` / `ipcRenderer.send`)
| Canal | Tipo | Ação |
|---|---|---|
| `get-settings` | invoke | Retorna configurações atuais |
| `save-settings` | invoke | Persiste configurações parciais |
| `get-app-version` | invoke | Retorna versão do app |
| `set-startup` | invoke | Ativa/desativa inicialização com o Windows |
| `refresh-now` | invoke | Dispara poll (respeita rate limit) |
| `force-refresh-now` | invoke | Dispara poll forçado (ignora rate limit) |
| `test-notification` | invoke | Envia notificação de teste |
| `tray-icon-data` | send | Envia PNG do canvas para atualizar ícone da bandeja |
| `set-window-height` | send | Ajusta altura do popup (mantém posição se movido pelo usuário) |
| `close-popup` | send | Oculta o popup |
| `open-release-url` | send | Abre URL no navegador padrão |

---

## Gestão da Posição do Popup

```
Abrir popup
  │
  ├─ [usuário moveu antes] → restaura savedPopupPosition (clamped na área de trabalho)
  └─ [posição padrão]      → posiciona acima do ícone da bandeja
        ├─ Centraliza horizontalmente sobre o ícone
        ├─ y = tray.y - popup.height - 8px
        └─ [barra de tarefas no topo] → y = tray.y + tray.height + 8px

Arrastar popup (evento 'moved')
  ├─ [isProgrammaticMove = true] → ignora (foi o próprio app que moveu)
  └─ [movimento do usuário]      → positionedByUser = true, salva nova posição

set-window-height (redimensionamento dinâmico)
  ├─ [positionedByUser = true]   → setBounds() mantendo x/y, ajusta apenas height
  └─ [posição padrão]            → reposiciona acima da bandeja com nova altura
```

---

## Pipeline de Build

```
npm run build
  │
  ├─ tsc -p tsconfig.main.json
  │     └─ src/main.ts + src/services/** + src/models/** → dist/ (CommonJS)
  │
  └─ node build-renderer.js
        ├─ esbuild src/renderer/app.ts → dist/renderer/app.js
        └─ copia index.html + styles.css → dist/renderer/

npm run dist
  │
  ├─ predist: rm -rf dist-build/   ← previne acúmulo de artefatos antigos
  ├─ npm run build
  └─ electron-builder --win
        ├─ NSIS installer → dist-build/Claude Usage Monitor Setup.exe
        └─ Portable EXE   → dist-build/Claude Usage Monitor.exe
             (~70–90 MB cada; se muito maior, artefatos antigos vazaram)
```

---

## Regras e Invariantes Importantes

| Regra | Motivo |
|---|---|
| `rateLimitedUntil` + `rateLimitCount` sempre persistidos no disco | Sobreviver a reinicializações do app |
| `triggerNow()` é no-op durante rate limit | Evita 429s adicionais |
| `forceNow()` ignora rate limit | Usado apenas internamente para testes |
| `utilization` pode ultrapassar 1.0 (ex: 16.0 = 1600%) | UI limita o gauge a 100% mas exibe ">1600%" |
| Ícone mostra `!!!` acima de 100% | Alerta visual sem depender de notificações |
| Nunca restringir schema do electron-store sem migration | Causa crash ao ler config antiga |
| `backgroundMaterial: 'acrylic'` | Efeito de desfoque nativo Windows 11 |
| `contextIsolation: true`, `nodeIntegration: false` | Segurança: renderer não acessa Node.js diretamente |
| Instância única (`requestSingleInstanceLock`) | Permite que o instalador NSIS detecte processo em execução |
