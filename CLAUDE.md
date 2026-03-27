# CLAUDE.md

## Commands
```bash
npm run dev          # compile main + start Electron (system tray)
npm run build        # compile main TS + bundle renderer
npm run dist         # NSIS installer + portable EXE → dist-build/
npm run dist:portable
npx tsc -p tsconfig.main.json   # main only
node build-renderer.js           # renderer only
```
No tests. Run `npm run build` and confirm clean exit before committing.

## Architecture
Electron app: main process (`src/main.ts`) + renderer (`src/renderer/`), context-isolated preload bridge.

**Main**: owns `Tray` + `BrowserWindow` (popup). Popup hidden by default, toggled on tray left-click, positioned above icon. `userMovedPopup` flag: when `true`, `set-window-height` only resizes (no reposition); resets on each open.

**Data flow**:
```
Anthropic API → usageApiService → pollingService → IPC:usage-updated → renderer
                                               → IPC:rate-limited  → countdown
                                               → notificationService
                                               → tray tooltip
```

## Services (`src/services/`)
| File | Role |
|------|------|
| `credentialService.ts` | Reads `~/.claude/.credentials.json`, refreshes OAuth token when <5min from expiry. Falls back to WSL paths. |
| `usageApiService.ts` | `GET /api/oauth/usage` (`anthropic-beta: oauth-2025-04-20`). Retries on 5xx only. 429 → throws `{isRateLimit:true}` immediately, reads `Retry-After`. |
| `pollingService.ts` | Normal=7min, Fast=5min (>1% spike), Idle=20min. Rate limit backoff: 5→10→20→40→60min. `triggerNow()` no-op while rate limited. |
| `settingsService.ts` | `electron-store`. Dev: `%APPDATA%\Electron\config.json`. Prod: `%APPDATA%\Claude Usage Monitor\config.json`. |
| `notificationService.ts` | Debounced — won't re-notify until usage drops below 50%. |
| `startupService.ts` | `auto-launch` via `HKCU\Run`. |

## Renderer (`src/renderer/`)
- `app.ts` — `esbuild` (not tsc). Chart.js doughnut `circumference:180°`. Draws tray icon on hidden `<canvas>`, sends PNG via `ipcRenderer.send('tray-icon-data',...)`.
- `styles.css` — dark/light via CSS vars. Win11 Acrylic: `backdrop-filter:blur(24px)` + `backgroundMaterial:'acrylic'`. Gauge size via `--gauge-w/h/pct-size` on `body[data-size]`.
- `preload.ts` — `contextBridge` → `window.claudeUsage`.

## Build pipeline
- Main: `tsc -p tsconfig.main.json` → `dist/` (CommonJS)
- Renderer: `esbuild` → `dist/renderer/app.js`; HTML/CSS copied by `build-renderer.js`
- Package: `electron-builder` (`build` key in `package.json`) → `dist-build/`

## Key notes
- `utilization` float can exceed 1.0 (e.g. `16.0` = 1600%). UI caps gauge at 100%, displays `>1600%`. Tray shows `!!!` above 100%.
- `rateLimitedUntil` + `rateLimitCount` persisted in settings. On startup, `main.ts` calls `pollingService.restoreRateLimit(until, count)` before `start()`.
- Credentials read directly from `~/.claude/.credentials.json` — CLI doesn't expose usage data.
- **Never tighten `minimum`/`maximum` on existing `electron-store` schema fields without a migration** — crashes app on startup.
