# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run in development (compiles main + starts Electron — app appears in system tray)
npm run dev

# Build only (compile main TS + bundle renderer, no packaging)
npm run build

# Package as NSIS installer + portable EXE in dist-build/
npm run dist

# Package portable EXE only
npm run dist:portable

# Compile main process only (faster iteration on services/main.ts)
npx tsc -p tsconfig.main.json

# Rebuild renderer only (faster iteration on src/renderer/)
node build-renderer.js
```

There are no tests. Manual verification steps are in the plan file at `C:\Users\edils\.claude\plans\harmonic-sprouting-kettle.md`.

## Architecture

**Two-process Electron app** — standard main/renderer split with a context-isolated preload bridge.

### Main process (`src/main.ts`)
Orchestrates all services. Owns the `Tray` and `BrowserWindow` (popup). The popup is hidden by default and toggled on tray left-click, positioned just above the tray icon. Right-click opens a context menu. All services run here; the renderer only receives data via IPC.

### Data flow
```
Anthropic API → usageApiService → pollingService → (IPC: usage-updated) → renderer UI
                                                 → notificationService (toasts)
                                                 → tray tooltip update
```

### Services (`src/services/`)
| File | Role |
|------|------|
| `credentialService.ts` | Reads `~/.claude/.credentials.json`, auto-refreshes OAuth token when <5 min from expiry. Falls back to WSL paths (`\\wsl.localhost\*`). |
| `usageApiService.ts` | `GET https://api.anthropic.com/api/oauth/usage` with `anthropic-beta: oauth-2025-04-20`. Exponential backoff on 429/5xx. |
| `pollingService.ts` | `EventEmitter`. Normal=7min, Fast=5min (after >1% spike), Idle=20min (`powerMonitor`), Error=exponential backoff. |
| `settingsService.ts` | `electron-store` backed config at `%APPDATA%\claude-usage\config.json`. |
| `notificationService.ts` | Electron `Notification` API. Debounced — won't re-notify until usage drops below 50% (reset). |
| `startupService.ts` | `auto-launch` wrapping Windows `HKCU\Run` registry key. |

### Renderer (`src/renderer/`)
- **`app.ts`** — compiled by `esbuild` (not tsc). Chart.js `doughnut` with `circumference: 180°` for the half-arc speedometers. Draws tray icon on a hidden `<canvas>` and sends the PNG data URL to main via `ipcRenderer.send('tray-icon-data', ...)`.
- **`styles.css`** — CSS custom properties for dark/light theme. `backdrop-filter: blur(24px)` + `backgroundMaterial: 'acrylic'` on the BrowserWindow gives the native Win11 Acrylic effect.
- **`preload.ts`** — `contextBridge` exposing `window.claudeUsage` API to the renderer.

### Build pipeline
- **Main process**: `tsc -p tsconfig.main.json` → `dist/` (CommonJS, excludes `src/renderer/`)
- **Renderer**: `esbuild` bundles `src/renderer/app.ts` → `dist/renderer/app.js`; HTML and CSS are copied as-is by `build-renderer.js`
- **Packaging**: `electron-builder` reads the `build` key in `package.json`; outputs to `dist-build/`

### API response shape
`utilization` is a float that can exceed `1.0` when the limit is surpassed (e.g. `16.0` = 1600%). The UI caps the gauge arc at 100% but displays the raw value with a `>` prefix (e.g. `>1600%`). The tray icon shows `!!!` when above 100%.

### Key constraint
The Claude CLI does **not** expose usage data — credentials are read directly from `~/.claude/.credentials.json` and the Anthropic API is called with the same OAuth token the CLI uses.
