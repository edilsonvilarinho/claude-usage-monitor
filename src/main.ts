import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen, powerMonitor, shell, Notification } from 'electron';
import * as path from 'path';
import { pollingService } from './services/pollingService';
import { getSettings, saveSettings } from './services/settingsService';
import { setLaunchAtStartup, isLaunchAtStartupEnabled } from './services/startupService';
import { checkAndNotify, syncWindowState, sendTestNotification } from './services/notificationService';
import { getMainTranslations } from './i18n/mainTranslations';
import { UsageData } from './models/usageData';
import { checkForUpdate } from './services/updateService';

// Prevent multiple instances (also allows NSIS installer to detect running process)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Required for Windows notifications
app.setAppUserModelId('com.claudeusage.monitor');

let tray: Tray | null = null;
let popup: BrowserWindow | null = null;
let lastUsageData: UsageData | null = null;
let suppressNextNotification = false;
let positionedByUser = false;
let savedPopupPosition: { x: number; y: number } | null = null;
let isProgrammaticMove = false;
let programmaticMoveTimer: ReturnType<typeof setTimeout> | null = null;
let currentRateLimitUntil = 0; // restored from disk on startup
let credentialMissing = false;
let credentialPath = '';

const POPUP_WIDTH  = 340;
const POPUP_HEIGHT = 210;

function markAsProgrammaticMove(): void {
  isProgrammaticMove = true;
  if (programmaticMoveTimer) clearTimeout(programmaticMoveTimer);
  programmaticMoveTimer = setTimeout(() => {
    isProgrammaticMove = false;
    programmaticMoveTimer = null;
  }, 300);
}

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

  // Re-send any pending state once renderer is ready (handles early IPC timing)
  win.webContents.once('did-finish-load', () => {
    if (credentialMissing) {
      win.webContents.send('credential-missing', credentialPath);
    }
  });

  win.on('blur', () => {
    if (popup && popup.isVisible() && !getSettings().alwaysVisible) {
      popup.hide();
    }
  });

  win.on('moved', () => {
    if (isProgrammaticMove) {
      isProgrammaticMove = false;
      if (programmaticMoveTimer) {
        clearTimeout(programmaticMoveTimer);
        programmaticMoveTimer = null;
      }
      return;
    }
    positionedByUser = true;
    const [px, py] = win.getPosition();
    savedPopupPosition = { x: px, y: py };
  });

  win.on('hide', () => {
    if (positionedByUser && popup) {
      const [px, py] = popup.getPosition();
      savedPopupPosition = { x: px, y: py };
    }
  });

  return win;
}

function positionPopup(height?: number): void {
  if (!tray || !popup) return;

  const h = height ?? popup.getSize()[1];
  const trayBounds = tray.getBounds();
  const workArea = screen.getPrimaryDisplay().workArea;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - POPUP_WIDTH / 2);
  let y = Math.round(trayBounds.y - h - 8);

  // Clamp horizontally
  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - POPUP_WIDTH));

  // If taskbar is at the top, position below the tray icon
  if (y < workArea.y) {
    y = trayBounds.y + trayBounds.height + 8;
  }

  markAsProgrammaticMove();
  if (height !== undefined) {
    popup.setBounds({ x, y, width: POPUP_WIDTH, height: h }, false);
  } else {
    popup.setPosition(x, y, false);
  }
}

function togglePopup(): void {
  if (!popup) return;

  if (popup.isVisible()) {
    popup.hide();
  } else {
    if (!getSettings().alwaysVisible) {
      if (savedPopupPosition) {
        const workArea = screen.getPrimaryDisplay().workArea;
        const clampedX = Math.max(workArea.x, Math.min(savedPopupPosition.x, workArea.x + workArea.width - POPUP_WIDTH));
        const [, currentH] = popup.getSize();
        const clampedY = Math.max(workArea.y, Math.min(savedPopupPosition.y, workArea.y + workArea.height - currentH));
        markAsProgrammaticMove();
        popup.setPosition(clampedX, clampedY, false);
        positionedByUser = true;
      } else {
        positionedByUser = false;
        positionPopup();
      }
    }
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
    // Re-surface credential error if still unresolved
    if (credentialMissing) {
      popup.webContents.send('credential-missing', credentialPath);
    }
  }
}

// ─── Tray icon ───────────────────────────────────────────────────────────────

function buildTrayIcon(): Electron.NativeImage {
  // Default icon (neutral) — a simple circle
  // The dynamic icon will be updated by the renderer via canvas
  return nativeImage.createEmpty();
}

function formatTimeUntil(isoDate: string): string {
  const diffMs = new Date(isoDate).getTime() - Date.now();
  if (diffMs <= 0) return 'soon';
  const totalMinutes = Math.floor(diffMs / 60000);
  const days    = Math.floor(totalMinutes / 1440);
  const hours   = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0)  return hours > 0  ? `${days}d ${hours}h`  : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

function updateTrayTooltip(data: UsageData): void {
  if (!tray) return;
  const t = getMainTranslations(getSettings().language);
  const sessionPct    = Math.round(data.five_hour.utilization).toString();
  const weeklyPct     = Math.round(data.seven_day.utilization).toString();
  const sessionResets = formatTimeUntil(data.five_hour.resets_at);
  const weeklyResets  = formatTimeUntil(data.seven_day.resets_at);
  tray.setToolTip(
    t.trayTooltipLine1(sessionPct, weeklyPct) + '\n' +
    t.trayTooltipLine2(sessionResets, weeklyResets) + '\n' +
    `v${app.getVersion()}`
  );
}

// ─── Update check ────────────────────────────────────────────────────────────

async function runUpdateCheck(forceCheck = false): Promise<void> {
  const settings = getSettings();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  if (!forceCheck && Date.now() - settings.lastUpdateCheck < TWENTY_FOUR_HOURS) {
    return;
  }
  try {
    const result = await checkForUpdate(app.getVersion());
    saveSettings({ lastUpdateCheck: Date.now() });
    if (result.hasUpdate) {
      showUpdateAvailableToast(result.latestVersion, result.releaseUrl);
      if (popup) {
        popup.webContents.send('update-available', { version: result.latestVersion, url: result.releaseUrl });
      }
    }
  } catch {
    // silent failure
  }
}

function showUpdateAvailableToast(version: string, url: string): void {
  if (!Notification.isSupported()) return;
  const notif = new Notification({
    title: 'Claude Usage Monitor',
    body: `v${version} is available. Click to download.`,
  });
  notif.on('click', () => {
    void shell.openExternal(url);
  });
  notif.show();
}

function buildContextMenu(): Menu {
  const settings = getSettings();
  const t = getMainTranslations(settings.language);
  return Menu.buildFromTemplate([
    {
      label: t.trayRefreshNow,
      click: () => void pollingService.triggerNow(),
    },
    {
      label: 'Check for Updates',
      click: () => void runUpdateCheck(true),
    },
    { type: 'separator' },
    {
      label: t.trayLaunchAtStartup,
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
      label: t.trayExit,
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
  t.setToolTip(`${getMainTranslations(getSettings().language).trayInitialTooltip} v${app.getVersion()}`);
  t.setContextMenu(buildContextMenu());

  t.on('click', () => togglePopup());

  return t;
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle('get-settings', () => getSettings());

  ipcMain.handle('get-app-version', () => app.getVersion());

  ipcMain.handle('save-settings', (_event, settings) => {
    saveSettings(settings);
    if (settings.launchAtStartup !== undefined) {
      setLaunchAtStartup(settings.launchAtStartup);
    }
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

  ipcMain.handle('force-refresh-now', async () => {
    suppressNextNotification = true;
    await pollingService.forceNow();
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

  ipcMain.on('open-release-url', (_e, url: string) => {
    void shell.openExternal(url);
  });

  ipcMain.on('set-window-height', (_event, height: number) => {
    if (!popup) return;
    const workArea = screen.getPrimaryDisplay().workArea;
    const h = Math.min(Math.round(height), workArea.height - 16);
    if (positionedByUser) {
      const [x, y] = popup.getPosition();
      // Clamp y so the window doesn't go below the screen bottom
      const clampedY = Math.min(y, workArea.y + workArea.height - h);
      markAsProgrammaticMove();
      popup.setBounds({ x, y: Math.max(workArea.y, clampedY), width: POPUP_WIDTH, height: h }, false);
    } else {
      positionPopup(h);
    }
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  registerIpcHandlers();

  // Restore rate-limit state from previous session
  const { rateLimitedUntil: saved, rateLimitCount: savedCount, rateLimitResetAt: savedResetAt, launchAtStartup } = getSettings();
  if (saved > Date.now()) {
    currentRateLimitUntil = saved;
    pollingService.restoreRateLimit(saved, savedCount || 1);
  }

  // Sync registry state: re-apply stored preference if it differs from actual registry value
  if (launchAtStartup !== undefined && isLaunchAtStartupEnabled() !== launchAtStartup) {
    setLaunchAtStartup(launchAtStartup);
  }

  tray = createTray();
  popup = createPopup();

  // Start polling and wire up events
  pollingService.on('usage-updated', (data: UsageData) => {
    lastUsageData = data;
    credentialMissing = false;
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
    const isCredError = err.message.includes('credentials not found') ||
                        err.message.includes('Invalid credentials file');
    if (isCredError) {
      credentialMissing = true;
      // Extract path from error message or fall back to default
      const match = err.message.match(/Expected location: (.+)/);
      credentialPath = match
        ? match[1].trim()
        : path.join(process.env['USERPROFILE'] || '~', '.claude', '.credentials.json');
      if (popup) {
        if (!popup.isVisible()) {
          if (!getSettings().alwaysVisible) {
            if (savedPopupPosition) {
              const workArea = screen.getPrimaryDisplay().workArea;
              const clampedX = Math.max(workArea.x, Math.min(savedPopupPosition.x, workArea.x + workArea.width - POPUP_WIDTH));
              const [, currentH] = popup.getSize();
              const clampedY = Math.max(workArea.y, Math.min(savedPopupPosition.y, workArea.y + workArea.height - currentH));
              markAsProgrammaticMove();
              popup.setPosition(clampedX, clampedY, false);
              positionedByUser = true;
            } else {
              positionedByUser = false;
              positionPopup();
            }
          }
          popup.show();
          popup.focus();
        }
        popup.webContents.send('credential-missing', credentialPath);
      }
      return; // do not send usage-error for credential errors
    }
    if (popup?.isVisible()) {
      popup.webContents.send('usage-error', err.message);
    }
  });

  pollingService.start();

  setTimeout(() => {
    void runUpdateCheck();
  }, 5000);
});

app.on('window-all-closed', () => {
  // Keep app running in tray — do not quit
});

app.on('before-quit', () => {
  pollingService.stop();
});
