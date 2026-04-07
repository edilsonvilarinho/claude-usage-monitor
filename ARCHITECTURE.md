# Claude Usage Monitor — Architecture

Windows/Linux system tray app built with Electron + TypeScript that polls the Anthropic API and displays Claude usage limits in a popup window.

---

## Directory structure

```
claude-usage-monitor/
├── src/
│   ├── main.ts                    # Electron main process — entry point
│   ├── preload.ts                 # Context bridge (main ↔ renderer)
│   ├── models/
│   │   └── usageData.ts           # Shared TypeScript interfaces
│   ├── services/
│   │   ├── credentialService.ts   # OAuth token read + refresh
│   │   ├── usageApiService.ts     # Anthropic API calls
│   │   ├── pollingService.ts      # Polling loop + backoff logic
│   │   ├── notificationService.ts # System toast notifications
│   │   ├── settingsService.ts     # electron-store persistence
│   │   ├── startupService.ts      # Windows registry auto-launch
│   │   ├── updateService.ts       # GitHub releases update check
│   │   └── dailySnapshotService.ts# Daily snapshot aggregation logic
│   ├── renderer/
│   │   ├── app.ts                 # Renderer UI logic (built by esbuild)
│   │   ├── index.html
│   │   └── styles.css
│   └── i18n/
│       └── mainTranslations.ts    # en / pt-BR strings for main process
├── assets/                        # Icons and static files
├── dist/                          # Compiled output (tsc + esbuild)
├── dist-build/                    # Packaged installer/portable (electron-builder)
└── build-renderer.js              # esbuild script for the renderer
```

---

## Data models (`src/models/usageData.ts`)

```
UsageWindow       { utilization: number, resets_at: string }
UsageData         { five_hour, seven_day, seven_day_sonnet?, sonnet_only?,
                    extra_usage? }
UsageSnapshot     { ts: number, session: number, weekly: number }
                  — snapshot persistido a cada poll para o histórico 24h
DailySnapshot     { date: string, maxWeekly: number, maxSession?: number,
                    maxCredits?: number, sessionResets?: number,
                    sessionAccum?: number }
                  — snapshot diário para o gráfico de ciclo semanal (máx 8 dias)
ProfileData       { account: { display_name, email, has_claude_pro,
                                has_claude_max } }
CredentialsFile   { claudeAiOauth: { accessToken, refreshToken, expiresAt,
                                     scopes?, subscriptionType? } }
AppSettings       (settingsService.ts) — all user preferences (global)
AccountData       (settingsService.ts) — per-account data keyed by email:
                  usageHistory: UsageSnapshot[] (máx 200),
                  dailyHistory: DailySnapshot[] (máx 8),
                  rateLimitedUntil, rateLimitCount, rateLimitResetAt
```

`utilization` is a float (0.0–N). Values above 1.0 mean >100% usage. The UI caps the gauge at 100% and displays `>1600%` for extreme values. The tray shows `!!!` above 100%.

---

## Data flow

```
~/.claude/.credentials.json
        │
        ▼
credentialService.getAccessToken()
        │  reads + auto-refreshes OAuth token when <5min from expiry
        ▼
usageApiService.fetchUsageData()
        │  GET api.anthropic.com/api/oauth/usage
        │  Header: anthropic-beta: oauth-2025-04-20
        │  429 → throws { isRateLimit:true, retryAfterMs, resetAt }
        │  5xx → retries up to 3x with exponential backoff
        ▼
pollingService (EventEmitter)
        │  emits 'usage-updated'  → main.ts updates tooltip + sends IPC to renderer
        │  emits 'rate-limited'   → main.ts sends IPC to renderer
        │  emits 'error'          → main.ts handles credential errors
        ▼
main.ts
        │  updateDailySnapshot() — atualiza DailySnapshot do dia com pico e resets
        │  checkAndNotify()      — notificações debounced
        ▼
BrowserWindow (popup)
        │  IPC: usage-updated, rate-limited, usage-error, credential-missing
        ▼
renderer/app.ts
        │  Chart.js doughnut gauge (180° half-circle)
        │  Sparkline 24h (Chart.js Line — colapsável)
        │  Gráfico de barras semanal (últimos 8 dias, sem Chart.js — DOM puro)
        │  draws tray icon on hidden <canvas> → sends PNG via sendTrayIcon()
        ▼
Tray icon (main process)
        receives PNG via ipcRenderer.send('tray-icon-data', dataUrl)
        updates tray image + tooltip
```

---

## Services

### `credentialService.ts`
- Searches for `~/.claude/.credentials.json` natively, then falls back to WSL paths (`\\wsl.localhost\<distro>\home\<user>\...`) on Windows.
- Picks the most recently modified file when multiple are found.
- Refreshes the OAuth token via `POST console.anthropic.com/v1/oauth/token` when `expiresAt - now < 5min`.
- On refresh failure, falls back to the cached token and logs a warning.

### `usageApiService.ts`
- `fetchUsageData()` — up to 3 attempts. Retries only on 5xx; on 429 throws immediately with `isRateLimit: true`.
- Reads `anthropic-ratelimit-*-reset` headers to determine exact rate limit expiry.
- `fetchProfileData()` — single request to `/api/oauth/profile`; no retry.
- Detects Claude CLI version via `claude --version` and caches it; used as `User-Agent`.

### `pollingService.ts` (`class PollingService extends EventEmitter`)

| State | Interval |
|---|---|
| Normal | 10 min |
| After >1% usage spike | 7 min (1 cycle) |
| System idle (>10 min) | 30 min |
| Network error | 1min × 2^n, max 20 min |
| Rate limited | API reset time → `Retry-After` → 5min × 2^n, max 60 min |

Key methods:
- `start()` / `stop()` — lifecycle
- `triggerNow()` — skips current timer; no-op if rate limited
- `forceNow()` — skips timer regardless of rate limit
- `restoreRateLimit(until, count, resetAt?)` — called on startup to restore persisted state
- `pause()` / `resume()` — suspende/retoma o polling (estado em memória apenas, não persiste)
- `setCustomInterval(ms)` — sobrescreve POLL_NORMAL_MS para o intervalo dado (mín 60s); `null` restaura adaptativo
- `nextPollAt` — getter returning the scheduled next poll timestamp (used in tray tooltip)
- `isPaused` — getter booleano; usado pelo tray menu para toggle label

### `notificationService.ts`
- `checkAndNotify(data)` — debounced: will not re-notify until usage drops below `resetThreshold` after a threshold alert.
- Detects time-window roll-overs by comparing `resets_at` between consecutive polls (gap > 1h for session, > 24h for weekly).
- `syncWindowState(data)` — called on manual refresh to prevent spurious "reset" notifications.
- `sendTestNotification()` — sends a test toast on demand.

### `settingsService.ts`
- Uses `electron-store` with JSON schema validation.
- Config file location:
  - Dev: `%APPDATA%\Electron\config.json`
  - Prod: `%APPDATA%\Claude Usage Monitor\config.json`
- **Two stores:** `config.json` (global AppSettings — preferences) + `accounts.json` (AccountData per email).
- **Per-account data** (`AccountData`): `usageHistory`, `dailyHistory`, `rateLimitedUntil`, `rateLimitCount`, `rateLimitResetAt` — keyed by account email.
- `setActiveAccount(email)` — switches active account; migrates legacy top-level data on first call for a given email. Safe to call multiple times.
- `getAccountData()` / `saveAccountData(partial)` — read/write data for the currently active account.
- **Rule:** Never tighten `minimum`/`maximum` on existing schema fields without a migration — crashes app on startup with existing data.

### `startupService.ts`
- Usa `app.setLoginItemSettings()` nativo do Electron (sem dependência `auto-launch`).
- On startup, `main.ts` re-applies stored preference if registry diverged.

### `updateService.ts`
- Queries `api.github.com/repos/edilsonvilarinho/claude-usage-monitor/releases/latest`.
- Checks at most once per 24 hours (tracked in `lastUpdateCheck` setting).
- On update: shows a system toast and sends `update-available` IPC to renderer.

### `dailySnapshotService.ts`
- `updateDailySnapshot(dailyHistory, today, data, prevData)` — pure function, no side effects.
- Detecta reset de sessão quando `resets_at` avança ≥ 30min em relação ao poll anterior.
- Quando um reset é detectado: acumula o pico da janela encerrada em `sessionAccum`, incrementa `sessionResets`.
- Mantém `maxSession`, `maxWeekly`, `maxCredits` como pico de cada dia.
- Histórico limitado a 8 dias (FIFO).

---

## Backup e importação (`main.ts`)

- `backupWeeklyData()` — serializa `dailyHistory` da conta ativa em JSON com `exportedAt`. Salva em `%APPDATA%\Claude Usage Monitor\backups\bk_DD_MM_YYYY_HH_MM.json`. Mantém apenas os 8 arquivos mais recentes.
- `importBackupData()` — abre `dialog.showOpenDialog` para selecionar arquivo(s). Mescla snapshots importados com os existentes, preservando os dados locais quando já há entrada para o mesmo dia (`date` como chave). Retorna `{ imported, merged }`.
- Disponível via:
  - Menu da bandeja do sistema: "Backup semanal" / "Import backup..."
  - IPC `backup-weekly-data` / `import-backup` (renderer → main)
  - Botões "Backup" e "Import" na seção de histórico do popup

---

## Main process (`src/main.ts`)

### Window management
- `createPopup()` — creates `BrowserWindow` (frameless + transparent on Windows; framed on Linux).
- `positionPopup(height?)` — positions popup above the tray icon; clamps to screen bounds; handles top taskbar.
- `togglePopup()` — shows/hides popup on tray left-click. Restores last position when user moved the window.
- `positionedByUser` flag — when `true`, `set-window-height` IPC only resizes without repositioning.
- Single-instance lock via `app.requestSingleInstanceLock()`.
- **Global hotkey:** `Ctrl+Shift+U` registrado via `globalShortcut` chama `togglePopup()`; desregistrado em `before-quit`.
- **Tray menu:** inclui toggle Pausar/Retomar monitoramento (chama `pollingService.pause()`/`resume()`), Backup semanal, Import backup e label informativo do hotkey.

### IPC channels

| Channel | Direction | Description |
|---|---|---|
| `get-settings` | invoke | Returns full AppSettings |
| `save-settings` | invoke | Persists partial AppSettings |
| `set-startup` | invoke | Toggle auto-launch |
| `refresh-now` | invoke | Trigger poll (suppresses notification if visible) |
| `force-refresh-now` | invoke | Force poll regardless of rate limit |
| `get-app-version` | invoke | Returns app version string |
| `get-profile` | invoke | Returns ProfileData (cached, TTL 1h; re-busca silenciosamente) |
| `get-usage-history` | invoke | Returns `UsageSnapshot[]` das últimas 24h |
| `get-daily-history` | invoke | Returns `DailySnapshot[]` (últimos 8 dias) |
| `save-daily-history` | invoke | Persiste edição manual de DailySnapshot[] |
| `set-poll-interval` | invoke | Define intervalo customizado no pollingService (ms ou null) |
| `test-notification` | invoke | Sends test toast |
| `backup-weekly-data` | invoke | Gera arquivo de backup e retorna o filepath |
| `import-backup` | invoke | Abre file dialog, mescla backup, retorna `{ imported, merged }` |
| `tray-icon-data` | send (renderer→main) | PNG dataURL for tray icon |
| `close-popup` | send (renderer→main) | Hides the popup |
| `set-window-height` | send (renderer→main) | Resizes popup height |
| `open-release-url` | send (renderer→main) | Opens URL in browser |
| `usage-updated` | send (main→renderer) | New UsageData |
| `rate-limited` | send (main→renderer) | Rate limit until + resetAt |
| `usage-error` | send (main→renderer) | Error message string |
| `credential-missing` | send (main→renderer) | Credential file path |
| `update-available` | send (main→renderer) | `{ version, url }` |

---

## Renderer (`src/renderer/app.ts`)

- Bundled by **esbuild** (not tsc). Output: `dist/renderer/app.js`.
- Registers on `window.claudeUsage.*` (exposed via preload `contextBridge`).
- Chart.js doughnut with `circumference: Math.PI` (180° half-circle gauge).
- **Sparkline (histórico 24h):** Chart.js Line chart colapsável abaixo dos gauges. Duas linhas: Sessão (verde) e Semanal (azul). Dados buscados via `get-usage-history` IPC. Toggle persiste em `showHistory`.
- **Gráfico de ciclo semanal:** DOM puro (sem Chart.js). Barras verticais por dia — Sessão (verde), Semanal (azul), Créditos (azul extra opcional). Tooltip nativo HTML em cada coluna com percentuais e resets. Legenda dentro da seção. **Edição manual** via clique duplo na coluna: abre modal inline com campos `maxSession`, `maxWeekly`, `maxCredits`, `sessionResets`; salva via `save-daily-history` IPC.
- Draws the tray icon on a hidden `<canvas>` and sends the PNG to main via `sendTrayIcon()`.
- **Tray icon adaptativo:** detecta `prefers-color-scheme` — fundo escuro/claro + texto correspondente. Re-renderiza via `matchMedia change` event.
- Theme: CSS vars `--bg`, `--text`, etc. Dark/light via `prefers-color-scheme` or forced via `body[data-theme]`.
- Window size: `body[data-size]` attribute controls `--gauge-w/h/pct-size` CSS vars.
- **Notification thresholds:** sliders `<input type="range">` com label dinâmico ao lado (sessão, semanal, reset).
- **autoRefresh:** ao ativar, chama `set-poll-interval` IPC em vez de criar `setInterval` próprio — polling unificado no main process.
- Win11 Acrylic effect: `backdrop-filter:blur(24px)` + `backgroundMaterial:'acrylic'` (main process, Windows only).

---

## Build pipeline

```
npm run build
  └─ tsc -p tsconfig.main.json     → dist/*.js (CommonJS, main + services)
  └─ node build-renderer.js        → dist/renderer/app.js (esbuild bundle)
                                     copies index.html + styles.css

npm run dist
  └─ predist: removes dist-build/
  └─ npm run build
  └─ electron-builder --win        → dist-build/
       • NSIS installer (~70–90 MB)
       • Portable EXE (~70–90 MB)

npm run release
  └─ dist + dist:portable + zip-release.js
```

Linux builds run via GitHub Actions on tag push (`v*`); never build locally on Windows (symlink permissions).

---

## Critical rules

1. **Never tighten `minimum`/`maximum` on electron-store schema fields** without migration — causes startup crash.
2. **Rate limit state must be persisted** (`rateLimitedUntil`, `rateLimitCount`, `rateLimitResetAt`) and restored via `pollingService.restoreRateLimit()` before `start()`.
3. **429 must never be retried** inside `usageApiService` — delegate backoff entirely to `pollingService`.
4. **`triggerNow()` is a no-op while rate limited** — use `forceNow()` only for explicit user actions that must bypass the limit.
5. **Never run `dist:linux` locally on Windows** — use GitHub Actions (symlink privileges required).
6. **`dist-build/` is auto-cleaned by `predist`** — never commit its contents or change the output directory without verifying artifact sizes.

---

## Tests

```
npm test           # vitest run (all tests)
npm run test:watch # watch mode
npm run test:coverage
```

Test files: `src/**/__tests__/*.test.ts`

Coverage: `credentialService`, `notificationService`, `pollingService`, `settingsService`, `startupService`, `updateService`, `usageApiService`, `dailySnapshotService`, `i18n/mainTranslations`.

Rules: deterministic only — no real network calls, no real timers without mocking. Cover failure paths, not just happy path.
