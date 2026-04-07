# CLAUDE.md

## Commands
```bash
npm run dev          # compile main + start Electron (system tray)
npm run build        # compile main TS + bundle renderer
npm run dist         # NSIS installer + portable EXE → dist-build/
npm run dist:portable
npm run dist:zip     # zip installer + portable → dist-build/
npm run release      # dist + dist:portable + zip → dist-build/
npx tsc -p tsconfig.main.json   # main only
node build-renderer.js           # renderer only
```
Run `npm test` after changes to services. Run `npm run build` and confirm clean exit before committing.

## Release checklist (`npm run dist`)
After every dist build, verify **before** publishing:
1. `dist-build/*.exe` sizes are ~70–90 MB — if much larger, old artifacts leaked in
2. `dist/` contains only compiled JS/HTML (no `.exe`, no `win-unpacked/`)
3. `predist` script auto-cleans `dist-build/` before each build to prevent accumulation

**Never** change `electron-builder` output dir or `files` glob without verifying sizes.

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
| `pollingService.ts` | Normal=10min, Fast=7min (>1% spike), Idle=30min. Rate limit backoff: 5→10→20→40→60min. `triggerNow()` no-op while rate limited. `pause()`/`resume()` para suspender polling. `setCustomInterval(ms)` sobrescreve intervalo normal. |
| `settingsService.ts` | `electron-store`. Dev: `%APPDATA%\Electron\config.json`. Prod: `%APPDATA%\Claude Usage Monitor\config.json`. |
| `notificationService.ts` | Debounced — won't re-notify until usage drops below 50%. |
| `startupService.ts` | `app.setLoginItemSettings()` nativo do Electron. |

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
