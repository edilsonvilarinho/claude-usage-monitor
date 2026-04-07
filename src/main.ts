import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen, powerMonitor, shell, Notification, globalShortcut } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { pollingService } from './services/pollingService';
import { getSettings, saveSettings, setActiveAccount, getAccountData, saveAccountData } from './services/settingsService';
import { setLaunchAtStartup, isLaunchAtStartupEnabled } from './services/startupService';
import { checkAndNotify, syncWindowState, sendTestNotification } from './services/notificationService';
import { getMainTranslations } from './i18n/mainTranslations';
import { UsageData, ProfileData, UsageSnapshot, DailySnapshot } from './models/usageData';
import { fetchProfileData } from './services/usageApiService';
import { checkForUpdate } from './services/updateService';

// Enable StatusNotifierItem on Linux for better tray compatibility (GNOME, Pantheon, KDE)
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'StatusNotifierItem');
}

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
let tooltipRefreshTimer: NodeJS.Timeout | null = null;
let suppressNextNotification = false;
let positionedByUser = false;
let savedPopupPosition: { x: number; y: number } | null = null;
let isProgrammaticMove = false;
let programmaticMoveTimer: ReturnType<typeof setTimeout> | null = null;
let currentRateLimitUntil = 0; // restored from disk on startup
let credentialMissing = false;
let credentialPath = '';
let cachedProfile: ProfileData | null = null;
let cachedProfileAt = 0;

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
  const isLinux = process.platform === 'linux';

  const win = new BrowserWindow({
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    frame: isLinux,
    transparent: !isLinux,
    skipTaskbar: !isLinux,
    alwaysOnTop: !isLinux,
    resizable: isLinux,
    show: false,
    ...(process.platform === 'win32' ? { backgroundMaterial: 'acrylic' as const } : {}),
    ...(isLinux ? { title: 'Claude Usage Monitor' } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Re-send any pending state once renderer is ready (handles early IPC timing)
  win.webContents.once('did-finish-load', () => {
    // On Linux: show after content is loaded (avoids blank window flash on startup)
    if (isLinux) {
      win.center();
      win.show();
    }
    if (credentialMissing) {
      win.webContents.send('credential-missing', credentialPath);
    }
  });

  // On Linux: close button hides the window instead of quitting
  if (isLinux) {
    win.on('close', (e) => {
      e.preventDefault();
      win.hide();
    });
  }

  win.on('blur', () => {
    if (isLinux) return; // Linux: never auto-hide on blur
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
      const { rateLimitResetAt } = getAccountData();
      popup.webContents.send('rate-limited', currentRateLimitUntil, rateLimitResetAt || undefined);
    }
    // Re-surface credential error if still unresolved
    if (credentialMissing) {
      popup.webContents.send('credential-missing', credentialPath);
    }
    // Send actual next poll time so countdown shows correct remaining time
    const npa = pollingService.nextPollAt;
    if (npa > Date.now()) {
      popup.webContents.send('next-poll-at', npa);
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

function formatResetAt(isoDate: string, locale: string): string {
  const date = new Date(isoDate);
  const diffMs = date.getTime() - Date.now();
  const isMultiDay = diffMs > 24 * 60 * 60 * 1000;

  const timeStr = date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });

  const tzParts = Intl.DateTimeFormat(locale, { timeZoneName: 'short' }).formatToParts(date);
  const tz = tzParts.find((p) => p.type === 'timeZoneName')?.value ?? '';

  if (isMultiDay) {
    const dayStr = date.toLocaleDateString(locale, { weekday: 'short' });
    return tz ? `${dayStr} ${timeStr} • ${tz}` : `${dayStr} ${timeStr}`;
  }
  return tz ? `${timeStr} • ${tz}` : timeStr;
}

function formatNextPoll(nextPollAt: number): string {
  const remaining = nextPollAt - Date.now();
  if (remaining <= 0) return '…';
  const totalSec = Math.ceil(remaining / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${String(sec).padStart(2, '0')}s`;
}

function updateTrayTooltip(data: UsageData): void {
  if (!tray) return;
  const t = getMainTranslations(getSettings().language);
  const sessionPct    = Math.round(data.five_hour.utilization).toString();
  const weeklyPct     = Math.round(data.seven_day.utilization).toString();
  const sessionResets = formatTimeUntil(data.five_hour.resets_at);
  const weeklyResets  = formatTimeUntil(data.seven_day.resets_at);
  const locale        = getSettings().language === 'pt-BR' ? 'pt-BR' : 'en';
  const sessionAt     = formatResetAt(data.five_hour.resets_at, locale);
  const weeklyAt      = formatResetAt(data.seven_day.resets_at, locale);
  const npAt = pollingService.nextPollAt;
  const nextLine = npAt > 0 ? t.trayTooltipNextUpdate(formatNextPoll(npAt)) : '';
  const parts = [
    t.trayTooltipLine1(sessionPct, weeklyPct),
    t.trayTooltipLine2(sessionResets, weeklyResets),
    t.trayTooltipLine3(sessionAt, weeklyAt),
  ];
  if (nextLine) parts.push(nextLine);
  if (pollingService.isPaused) parts.push(t.trayPaused);
  const tooltip = parts.join('\n');
  tray.setToolTip(tooltip.length > 127 ? tooltip.slice(0, 127) : tooltip);
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

// ─── Weekly backup ───────────────────────────────────────────────────────────

async function backupWeeklyData(): Promise<string> {
  const accountData = getAccountData();
  const dailyHistory = accountData.dailyHistory ?? [];

  // Calcular semana ISO atual (YYYY-Www)
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const weekNum = Math.ceil(((now.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7);
  const weekLabel = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

  const backupDir = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filename = `backup-${weekLabel}.json`;
  const filepath = path.join(backupDir, filename);

  const payload = {
    week: weekLabel,
    exportedAt: new Date().toISOString(),
    dailyHistory,
  };

  fs.writeFileSync(filepath, JSON.stringify(payload, null, 2), 'utf-8');

  // Manter apenas os últimos 8 backups
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .sort();
  if (files.length > 8) {
    for (const old of files.slice(0, files.length - 8)) {
      fs.unlinkSync(path.join(backupDir, old));
    }
  }

  return filepath;
}

function buildContextMenu(): Menu {
  const settings = getSettings();
  const t = getMainTranslations(settings.language);
  const template: Electron.MenuItemConstructorOptions[] = [];

  if (process.platform === 'linux') {
    template.push({ label: 'Show Window', click: () => togglePopup() });
    template.push({ type: 'separator' });
  }

  template.push(
    { label: t.trayRefreshNow, click: () => void pollingService.triggerNow() },
    {
      label: pollingService.isPaused ? t.trayResume : t.trayPause,
      click: () => {
        if (pollingService.isPaused) {
          pollingService.resume();
        } else {
          pollingService.pause();
        }
        tray?.setContextMenu(buildContextMenu());
      },
    },
    { label: 'Check for Updates', click: () => void runUpdateCheck(true) },
    { label: 'Export weekly data', click: () => {
        void backupWeeklyData().then(filepath => {
          new Notification({ title: 'Backup saved', body: filepath }).show();
        }).catch(err => {
          new Notification({ title: 'Backup failed', body: String(err) }).show();
        });
      }
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
        tray?.setContextMenu(buildContextMenu());
      },
    },
    { type: 'separator' },
    { label: 'Ctrl+Shift+U — Toggle window', enabled: false },
    { label: t.trayExit, click: () => app.quit() }
  );

  return Menu.buildFromTemplate(template);
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
    // Only suppress notifications when the popup is visible (user is actively watching).
    // If the popup is hidden, auto-refresh runs in the background and must not block alerts.
    if (popup?.isVisible()) suppressNextNotification = true;
    await pollingService.triggerNow();
  });

  ipcMain.handle('force-refresh-now', async () => {
    if (popup?.isVisible()) suppressNextNotification = true;
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

  ipcMain.handle('get-profile', async () => {
    const ONE_HOUR = 3_600_000;
    if (cachedProfile && Date.now() - cachedProfileAt < ONE_HOUR) return cachedProfile;
    try {
      cachedProfile = await fetchProfileData();
      cachedProfileAt = Date.now();
      return cachedProfile;
    } catch {
      return cachedProfile; // retorna cache stale em caso de erro
    }
  });

  ipcMain.on('close-popup', () => {
    popup?.hide();
  });

  ipcMain.on('open-release-url', (_e, url: string) => {
    void shell.openExternal(url);
  });

  ipcMain.handle('get-usage-history', () => getAccountData().usageHistory ?? []);

  ipcMain.handle('get-daily-history', () => getAccountData().dailyHistory ?? []);

  ipcMain.handle('clear-daily-history', () => {
    saveAccountData({ dailyHistory: [] });
  });

  ipcMain.handle('backup-weekly-data', async () => {
    return backupWeeklyData();
  });

  ipcMain.handle('set-poll-interval', (_event, ms: number | null) => {
    pollingService.setCustomInterval(ms);
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

  // Restore rate-limit state from previous session (per-account)
  const { rateLimitedUntil: saved, rateLimitCount: savedCount, rateLimitResetAt: savedResetAt } = getAccountData();
  const { launchAtStartup } = getSettings();
  if (saved > Date.now()) {
    currentRateLimitUntil = saved;
    pollingService.restoreRateLimit(saved, savedCount || 1, savedResetAt || undefined);
  }

  // Sync registry state: re-apply stored preference if it differs from actual registry value
  if (launchAtStartup !== undefined && isLaunchAtStartupEnabled() !== launchAtStartup) {
    setLaunchAtStartup(launchAtStartup);
  }

  tray = createTray();
  popup = createPopup();

  const registered = globalShortcut.register('Ctrl+Shift+U', () => togglePopup());
  if (!registered) {
    console.warn('[Main] Failed to register global shortcut Ctrl+Shift+U — may be in use by another app');
  }

  void fetchProfileData().then(p => { cachedProfile = p; cachedProfileAt = Date.now(); setActiveAccount(p.account.email); }).catch(() => {});

  // Start polling and wire up events
  pollingService.on('usage-updated', (data: UsageData) => {
    const prevData = lastUsageData; // captura antes de sobrescrever
    lastUsageData = data;
    credentialMissing = false;
    if (currentRateLimitUntil > 0) {
      currentRateLimitUntil = 0;
      saveAccountData({ rateLimitedUntil: 0, rateLimitCount: 0 });
    }
    // Snapshot de histórico (máx 200 pontos ≈ 24h a cada 7min)
    const MAX_HISTORY = 200;
    const snapshot: UsageSnapshot = {
      ts: Date.now(),
      session: Math.round(data.five_hour.utilization),
      weekly: Math.round(data.seven_day.utilization),
    };
    const history = getAccountData().usageHistory ?? [];
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

    // Snapshot diário (sempre gravado, independente do toggle)
    // Usa 'sv' locale para obter formato YYYY-MM-DD na timezone local
    const today = new Date().toLocaleDateString('sv');
    const weeklyPctInt  = Math.round(data.seven_day.utilization);
    const sessionPctInt = Math.round(data.five_hour.utilization);
    const extra = data.extra_usage;
    const creditsPctInt = (extra?.is_enabled && extra.monthly_limit > 0)
      ? Math.round((extra.used_credits / extra.monthly_limit) * 100)
      : undefined;
    const dailyHistory: DailySnapshot[] = getAccountData().dailyHistory ?? [];
    const existingDay = dailyHistory.find(d => d.date === today);

    // Detectar reset de sessão: resets_at avançou pelo menos 30min (evita falsos positivos
    // por variações mínimas no timestamp retornado pela API)
    let sessionResetOccurred = false;
    if (prevData) {
      const prevResetsAt = new Date(prevData.five_hour.resets_at).getTime();
      const currResetsAt = new Date(data.five_hour.resets_at).getTime();
      const THIRTY_MINUTES_MS = 30 * 60 * 1000;
      if (currResetsAt - prevResetsAt >= THIRTY_MINUTES_MS) {
        sessionResetOccurred = true;
      }
    }

    if (existingDay) {
      // Se houve reset, acumula o pico da janela que acabou e reinicia maxSession
      if (sessionResetOccurred) {
        const peakOfCompletedWindow = Math.round(prevData!.five_hour.utilization);
        existingDay.sessionAccum  = (existingDay.sessionAccum  ?? 0) + peakOfCompletedWindow;
        existingDay.sessionResets = (existingDay.sessionResets ?? 1) + 1;
        existingDay.maxSession = sessionPctInt; // nova janela — começa do valor atual
      } else {
        existingDay.maxSession = Math.max(existingDay.maxSession ?? 0, sessionPctInt);
      }
      existingDay.maxWeekly  = Math.max(existingDay.maxWeekly, weeklyPctInt);
      if (creditsPctInt !== undefined) {
        existingDay.maxCredits = Math.max(existingDay.maxCredits ?? 0, creditsPctInt);
      }
    } else {
      dailyHistory.push({ date: today, maxWeekly: weeklyPctInt, maxSession: sessionPctInt, maxCredits: creditsPctInt, sessionResets: 1, sessionAccum: 0 });
    }
    dailyHistory.sort((a, b) => a.date.localeCompare(b.date));
    if (dailyHistory.length > 8) dailyHistory.splice(0, dailyHistory.length - 8);

    saveAccountData({ usageHistory: history, dailyHistory });

    updateTrayTooltip(data);
    if (tooltipRefreshTimer) clearInterval(tooltipRefreshTimer);
    tooltipRefreshTimer = setInterval(() => {
      if (lastUsageData) updateTrayTooltip(lastUsageData);
    }, 60_000);
    // Backup automático ao detectar reset semanal
    if (prevData) {
      const prevResetsAt = new Date(prevData.seven_day.resets_at).getTime();
      const currResetsAt = new Date(data.seven_day.resets_at).getTime();
      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
      if (currResetsAt - prevResetsAt >= TWENTY_FOUR_HOURS_MS) {
        void backupWeeklyData().then(filepath => {
          new Notification({ title: 'Weekly backup saved', body: filepath }).show();
        }).catch(err => {
          console.error('[Main] Auto-backup failed:', err);
        });
      }
    }

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

    if (Date.now() - cachedProfileAt > 3_600_000) {
      void fetchProfileData().then(p => { cachedProfile = p; cachedProfileAt = Date.now(); setActiveAccount(p.account.email); if (popup) popup.webContents.send('profile-updated', cachedProfile); }).catch(() => {});
    }
  });

  pollingService.on('next-poll-scheduled', (nextPollAt: number) => {
    popup?.webContents.send('next-poll-at', nextPollAt);
  });

  pollingService.on('rate-limited', (until: number, count: number, resetAt?: number) => {
    currentRateLimitUntil = until;
    saveAccountData({ rateLimitedUntil: until, rateLimitCount: count, rateLimitResetAt: resetAt ?? 0 });
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
        : path.join(process.env['USERPROFILE'] || process.env['HOME'] || '~', '.claude', '.credentials.json');
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
  // Allow the window to close when app is actually quitting (Linux)
  if (popup) popup.removeAllListeners('close');
  pollingService.stop();
  if (tooltipRefreshTimer) { clearInterval(tooltipRefreshTimer); tooltipRefreshTimer = null; }
  globalShortcut.unregisterAll();
});
