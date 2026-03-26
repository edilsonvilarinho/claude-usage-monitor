# Claude Usage Monitor

A Windows system tray app that monitors your Claude AI usage limits in real time — without needing the Claude CLI or any extra configuration.

![Preview](assets/preview.png)

---

## Features

### Usage gauges
- **Session (5h)** and **Weekly (7d)** half-arc speedometers showing current utilization at a glance
- Color coding: green → yellow (60%) → red (80%)
- Displays time remaining until each window resets
- Optional bars for **Sonnet** model usage and **extra credits** (shown only when your account has them)

### Tray icon
- Live circular progress ring in the system tray reflecting the highest of the two gauges
- Shows the percentage number inside the icon
- Displays `!!!` when usage exceeds 100%
- Tooltip shows session and weekly percentages on hover

### Auto refresh
- Toggle **Auto refresh** in settings to poll the API automatically while the window is open
- Configurable interval (minimum 60 seconds — recommended 300s to avoid rate limiting)

### Rate limit handling
- When the API returns 429, the app stops retrying immediately and shows a countdown banner
- Exponential backoff on consecutive rate limits: 5m → 10m → 20m → 40m → 60m (cap)
- The countdown and backoff state survive app restarts — reopening the app shows the correct remaining time
- Automatically resumes normal polling once the cooldown expires

### Notifications
- Desktop toast when usage crosses your configured threshold (session and/or weekly)
- Optional sound alert
- Notify when a usage window resets
- Test button to preview the notification

### Configurable window size
Four sizes to choose from — scales the gauge charts:
| Size | Description |
|---|---|
| Normal | Compact |
| Medium | Slightly larger gauges |
| Large | Big gauges, easy to read (default) |
| Very Large | Maximum gauge size |

### Moveable window
Drag the popup anywhere on screen — it stays where you left it. It only returns above the tray icon when you close and reopen it.

### Themes
- **System** (follows Windows light/dark mode)
- **Dark**
- **Light**

Native Windows 11 Acrylic blur effect on the popup background.

### Language
- English
- Português (BR)

### General settings
- **Launch at startup** — registers to Windows `HKCU\Run` so the app starts with Windows
- **Always visible** — disables auto-hide on focus loss

---

## How it works

Claude Usage Monitor reads credentials directly from `~/.claude/.credentials.json` (the same file the Claude CLI uses) and calls the Anthropic API with your OAuth token. No API key setup needed — if you have the Claude CLI installed and logged in, it just works.

The token is automatically refreshed when it's close to expiry.

---

## Installation

Download the latest release from the [Releases](../../releases) page:

- **`Claude Usage Monitor Setup.exe`** — NSIS installer
- **`Claude Usage Monitor.exe`** — Portable, no installation needed

### Build from source

Requirements: Node.js 18+, Windows

```bash
git clone https://github.com/edilsonvilarinho/claude-usage-monitor
cd claude-usage-monitor
npm install

# Run in development
npm run dev

# Build installer + portable EXE
npm run dist

# Portable EXE only
npm run dist:portable
```

---

## Requirements

- Windows 10 / 11
- [Claude CLI](https://claude.ai/download) installed and logged in (`~/.claude/.credentials.json` must exist)

---

## Privacy

All data stays local. The app only makes requests to `api.anthropic.com` using your existing Claude OAuth token — the same requests the Claude CLI itself makes. No telemetry, no third-party services.
