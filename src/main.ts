import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen, powerMonitor } from 'electron';
import * as path from 'path';
import { pollingService } from './services/pollingService';
import { getSettings, saveSettings } from './services/settingsService';
import { setLaunchAtStartup } from './services/startupService';
import { checkAndNotify, syncWindowState, sendTestNotification } from './services/notificationService';
import { UsageData } from './models/usageData';

// Required for Windows notifications
app.setAppUserModelId('com.claudeusage.monitor');

let tray: Tray | null = null;
let popup: BrowserWindow | null = null;
let lastUsageData: UsageData | null = null;
let suppressNextNotification = false;
let userMovedPopup = false;
let currentRateLimitUntil = 0; // restored from disk on startup

const POPUP_WIDTH  = 340;
const POPUP_HEIGHT = 210;

// ─── Window management ───────────────────────────────────────────────────────

function createPopup(): BrowserWindow {
  const win = new BrowserWindow({
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: false,
    show: false,
    backgroundMaterial: 'acrylic',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.on('blur', () => {
    if (popup && popup.isVisible() && !getSettings().alwaysVisible) {
      popup.hide();
    }
  });

  win.on('moved', () => {
    userMovedPopup = true;
  });

  return win;
}

function positionPopup(): void {
  if (!tray || !popup) return;

  const [, currentHeight] = popup.getSize();
  const trayBounds = tray.getBounds();
  const workArea = screen.getPrimaryDisplay().workArea;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - POPUP_WIDTH / 2);
  let y = Math.round(trayBounds.y - currentHeight - 8);

  // Clamp horizontally
  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - POPUP_WIDTH));

  // If taskbar is at the top, position below the tray icon
  if (y < workArea.y) {
    y = trayBounds.y + trayBounds.height + 8;
  }

  popup.setPosition(x, y, false);
}

function togglePopup(): void {
  if (!popup) return;

  if (popup.isVisible()) {
    popup.hide();
  } else {
    userMovedPopup = false;
    positionPopup();
    popup.show();
    popup.focus();

    // Send current data immediately when opening
    if (lastUsageData) {
      popup.webContents.send('usage-updated', lastUsageData);
    }
    // Restore rate-limit countdown if still active
    if (currentRateLimitUntil > Date.now()) {
      const { rateLimitResetAt } = getSettings();
      popup.webContents.send('rate-limited', currentRateLimitUntil, rateLimitResetAt || undefined);
    }
  }
}

// ─── Tray icon ───────────────────────────────────────────────────────────────

function buildTrayIcon(): Electron.NativeImage {
  // Default icon (neutral) — a simple circle
  // The dynamic icon will be updated by the renderer via canvas
  return nativeImage.createEmpty();
}

function updateTrayTooltip(data: UsageData): void {
  if (!tray) return;
  const sessionPct = Math.round(data.five_hour.utilization);
  const weeklyPct  = Math.round(data.seven_day.utilization);
  tray.setToolTip(`Claude Usage — Session: ${sessionPct}% | Weekly: ${weeklyPct}%`);
}

function buildContextMenu(): Menu {
  const settings = getSettings();
  return Menu.buildFromTemplate([
    {
      label: 'Refresh Now',
      click: () => void pollingService.triggerNow(),
    },
    { type: 'separator' },
    {
      label: 'Launch at Startup',
      type: 'checkbox',
      checked: settings.launchAtStartup,
      click: (menuItem) => {
        const enabled = menuItem.checked;
        saveSettings({ launchAtStartup: enabled });
        void setLaunchAtStartup(enabled);
        // Rebuild menu to reflect new state
        tray?.setContextMenu(buildContextMenu());
      },
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => app.quit(),
    },
  ]);
}

function createTray(): Tray {
  // Use a blank icon initially; renderer will update it via canvas
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath).isEmpty()
    ? nativeImage.createEmpty()
    : nativeImage.createFromPath(iconPath);

  const t = new Tray(icon);
  t.setToolTip('Claude Usage Monitor');
  t.setContextMenu(buildContextMenu());

  t.on('click', () => togglePopup());

  return t;
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle('get-settings', () => getSettings());

  ipcMain.handle('save-settings', (_event, settings) => {
    saveSettings(settings);
    // Rebuild tray context menu to reflect startup state changes
    tray?.setContextMenu(buildContextMenu());
  });

  ipcMain.handle('set-startup', async (_event, enabled: boolean) => {
    saveSettings({ launchAtStartup: enabled });
    await setLaunchAtStartup(enabled);
    tray?.setContextMenu(buildContextMenu());
  });

  ipcMain.handle('refresh-now', async () => {
    suppressNextNotification = true;
    await pollingService.triggerNow();
  });

  ipcMain.on('tray-icon-data', (_event, dataUrl: string) => {
    if (!tray || !dataUrl) return;
    try {
      const img = nativeImage.createFromDataURL(dataUrl);
      if (!img.isEmpty()) {
        tray.setImage(img);
      }
    } catch (err) {
      console.error('[Main] Failed to set tray icon:', err);
    }
  });

  ipcMain.handle('test-notification', () => {
    sendTestNotification();
  });

  ipcMain.on('close-popup', () => {
    popup?.hide();
  });

  ipcMain.on('set-window-height', (_event, height: number) => {
    if (!popup) return;
    const workArea = screen.getPrimaryDisplay().workArea;
    const h = Math.min(Math.round(height), workArea.height - 16);
    if (userMovedPopup) {
      const [x, y] = popup.getPosition();
      // Clamp y so the window doesn't go below the screen bottom
      const clampedY = Math.min(y, workArea.y + workArea.height - h);
      popup.setBounds({ x, y: Math.max(workArea.y, clampedY), width: POPUP_WIDTH, height: h }, false);
    } else {
      popup.setSize(POPUP_WIDTH, h, false);
      positionPopup();
    }
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Prevent app from showing in taskbar
  if (process.platform === 'win32') {
    app.setLoginItemSettings({ openAtLogin: false });
  }

  registerIpcHandlers();

  // Restore rate-limit state from previous session
  const { rateLimitedUntil: saved, rateLimitCount: savedCount, rateLimitResetAt: savedResetAt } = getSettings();
  if (saved > Date.now()) {
    currentRateLimitUntil = saved;
    pollingService.restoreRateLimit(saved, savedCount || 1);
  }

  tray = createTray();
  popup = createPopup();

  // Start polling and wire up events
  pollingService.on('usage-updated', (data: UsageData) => {
    lastUsageData = data;
    if (currentRateLimitUntil > 0) {
      currentRateLimitUntil = 0;
      saveSettings({ rateLimitedUntil: 0, rateLimitCount: 0 });
    }
    updateTrayTooltip(data);
    if (suppressNextNotification) {
      syncWindowState(data);
      suppressNextNotification = false;
    } else {
      checkAndNotify(data);
    }

    if (popup?.isVisible()) {
      popup.webContents.send('usage-updated', data);
    }

    // Always update tray icon via renderer (even when hidden)
    // Send to renderer to draw the canvas icon
    if (popup) {
      popup.webContents.send('usage-updated', data);
    }
  });

  pollingService.on('rate-limited', (until: number, count: number, resetAt?: number) => {
    currentRateLimitUntil = until;
    saveSettings({ rateLimitedUntil: until, rateLimitCount: count, rateLimitResetAt: resetAt ?? 0 });
    if (popup?.isVisible()) {
      popup.webContents.send('rate-limited', until, resetAt);
    }
  });

  pollingService.on('error', (err: Error) => {
    if (popup?.isVisible()) {
      popup.webContents.send('usage-error', err.message);
    }
  });

  pollingService.start();
});

app.on('window-all-closed', () => {
  // Keep app running in tray — do not quit
});

app.on('before-quit', () => {
  pollingService.stop();
});
