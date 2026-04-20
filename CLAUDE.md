# CLAUDE.md

## Idioma
- Sempre responda ao usuário em **pt-br**
- Mensagens de commit devem ser escritas em **pt-br**

## Commands
```bash
npm run dev          # compile main + start Electron (system tray)
npm run build        # compile main TS + bundle renderer
npm run dist         # NSIS installer + portable EXE → dist-build/
npm run dist:zip     # zip installer + portable → dist-build/
npm run release      # dist + dist:portable + zip → dist-build/
```
Run `npm test` after changes to services. Run `npm run build` and confirm clean exit before committing.

## Release checklist (`npm run dist`)
Before publishing:
1. `dist-build/*.exe` sizes are ~70–90 MB — if much larger, old artifacts leaked in
2. `dist/` contains only compiled JS/HTML (no `.exe`, no `win-unpacked/`)

## Clean Architecture — Regra Inviolável

Todo código novo ou modificado deve respeitar Clean Architecture. Sem exceções.

**Camadas e onde vive cada coisa:**
| Camada | Pasta | O que contém |
|--------|-------|--------------|
| Domain | `src/domain/` | Entidades, tipos, regras de negócio puras (sem dependências externas) |
| Application | `src/application/` | Use cases, mapeadores, orquestração entre domain e infra |
| Infrastructure | `src/services/`, `src/main.ts` | Electron, IPC, APIs externas, storage |
| Presentation | `src/presentation/` | Páginas, layouts, componentes, formatters, i18n |
| Renderer bootstrap | `src/renderer/` | Apenas inicialização e stores reativos |

**Proibido:**
- Presentation importar de `src/services/` ou `src/main.ts` diretamente
- Domain importar de qualquer outra camada
- Formatters de UI com lógica de negócio (cálculos, regras)
- Funções com parâmetros não utilizados (dead params)
- Imports de módulo errado (ex: `Lang` de `renderer/app` em vez de `presentation/layouts/i18n`)

**Obrigatório ao criar/modificar código:**
- Identificar a camada correta antes de escrever
- Respeitar o fluxo: Domain ← Application ← Infrastructure / Presentation
- Tipos e contratos definidos na camada mais interna que os usa

## Architecture
Electron app: main process (`src/main.ts`) + renderer (`src/renderer/`), context-isolated preload bridge.

**Main**: owns `Tray` + `BrowserWindow` (popup). Popup hidden by default, toggled on tray left-click, positioned above icon. `userMovedPopup` flag: when `true`, `set-window-height` only resizes (no reposition); resets on each open.

**Data flow**:
```
Anthropic API → usageApiService → pollingService → IPC:usage-updated → renderer
                                               → IPC:rate-limited  → countdown
                                               → notificationService → tray tooltip
```

## Services (`src/services/`)
| File | Role |
|------|------|
| `credentialService.ts` | Reads `~/.claude/.credentials.json`, refreshes OAuth token when <5min from expiry. Falls back to WSL paths. |
| `usageApiService.ts` | `GET /api/oauth/usage` (`anthropic-beta: oauth-2025-04-20`). Retries on 5xx only. 429 → throws `{isRateLimit:true}`, reads `Retry-After`. |
| `pollingService.ts` | Normal=10min, Fast=7min (>1% spike), Idle=30min. Rate limit backoff: 5→10→20→40→60min. `triggerNow()` no-op while rate limited. `setCustomInterval(ms)` sobrescreve intervalo normal. |
| `settingsService.ts` | `electron-store`. Dev: `%APPDATA%\Electron\config.json`. Prod: `%APPDATA%\Claude Usage Monitor\config.json`. |
| `notificationService.ts` | Debounced — won't re-notify until usage drops below 50%. |

## Key notes
- `utilization` float can exceed 1.0 (e.g. `16.0` = 1600%). UI caps gauge at 100%, displays `>1600%`. Tray shows `!!!` above 100%.
- `rateLimitedUntil` + `rateLimitCount` persisted in settings. On startup, `main.ts` calls `pollingService.restoreRateLimit(until, count)` before `start()`.
- Renderer: Chart.js doughnut `circumference:180°`. Tray icon drawn on `<canvas>`, sent as PNG via `ipcRenderer.send('tray-icon-data',...)`.
- **Never tighten `minimum`/`maximum` on existing `electron-store` schema fields without a migration** — crashes app on startup.
