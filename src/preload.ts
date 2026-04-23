import { contextBridge, ipcRenderer } from 'electron';
import { UsageData, ProfileData } from './models/usageData';
import { AppSettings } from './services/settingsService';

contextBridge.exposeInMainWorld('claudeUsage', {
  onUsageUpdated: (cb: (data: UsageData) => void) => {
    ipcRenderer.on('usage-updated', (_event, data: UsageData) => cb(data));
  },

  onError: (cb: (message: string) => void) => {
    ipcRenderer.on('usage-error', (_event, message: string) => cb(message));
  },

  onRateLimited: (cb: (until: number, resetAt?: number) => void) => {
    ipcRenderer.on('rate-limited', (_event, until: number, resetAt?: number) => cb(until, resetAt));
  },

  onSmartStatusUpdated: (cb: (status: import('./services/smartScheduleService').SmartStatus) => void) => {
    ipcRenderer.on('smart-status-updated', (_e, s) => cb(s));
  },

  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke('get-settings');
  },

  saveSettings: (settings: Partial<AppSettings>): Promise<void> => {
    return ipcRenderer.invoke('save-settings', settings);
  },

  setStartup: (enabled: boolean): Promise<void> => {
    return ipcRenderer.invoke('set-startup', enabled);
  },

  refreshNow: (): Promise<void> => {
    return ipcRenderer.invoke('refresh-now');
  },

  forceRefreshNow: (): Promise<void> => {
    return ipcRenderer.invoke('force-refresh-now');
  },

  sendTrayIcon: (dataUrl: string): void => {
    ipcRenderer.send('tray-icon-data', dataUrl);
  },

  testNotification: (): Promise<void> => {
    return ipcRenderer.invoke('test-notification');
  },

  closeWindow: (): void => {
    ipcRenderer.send('close-popup');
  },

  setWindowHeight: (height: number): void => {
    ipcRenderer.send('set-window-height', height);
  },

  onUpdateAvailable: (cb: (info: { version: string; url: string; downloadUrl: string; isMajor: boolean }) => void): void => {
    ipcRenderer.on('update-available', (_event, info: { version: string; url: string; downloadUrl: string; isMajor: boolean }) => cb(info));
  },

  openReleaseUrl: (url: string): void => {
    ipcRenderer.send('open-release-url', url);
  },

  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('download-update'),

  dismissUpdate: (): void => { ipcRenderer.send('dismiss-update'); },

  onUpdateDownloadProgress: (cb: (pct: number) => void): void => {
    ipcRenderer.on('update-download-progress', (_event, pct: number) => cb(pct));
  },

  onCredentialMissing: (cb: (credPath: string) => void): void => {
    ipcRenderer.on('credential-missing', (_e, credPath: string) => cb(credPath));
  },

  startOAuthLogin: (): Promise<void> => ipcRenderer.invoke('start-oauth-login'),

  onOAuthLoginComplete: (cb: () => void): void => {
    ipcRenderer.on('oauth-login-complete', () => cb());
  },

  onOAuthLoginError: (cb: (message: string) => void): void => {
    ipcRenderer.on('oauth-login-error', (_e, message: string) => cb(message));
  },

  saveManualCredentials: (creds: { accessToken: string; refreshToken?: string }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('save-manual-credentials', creds),

  onCredentialsExpired: (cb: () => void): void => {
    ipcRenderer.on('credentials-expired', () => {
      ipcRenderer.send('credentials-expired-received');
      cb();
    });
  },

  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),

  getProfile: (): Promise<ProfileData | null> => ipcRenderer.invoke('get-profile'),

  setPollInterval: (ms: number | null): Promise<void> => ipcRenderer.invoke('set-poll-interval', ms),

  getUsageHistory: (): Promise<import('./models/usageData').UsageSnapshot[]> => ipcRenderer.invoke('get-usage-history'),

  getDailyHistory: (): Promise<import('./models/usageData').DailySnapshot[]> => ipcRenderer.invoke('get-daily-history'),

  clearDailyHistory: (): Promise<void> => ipcRenderer.invoke('clear-daily-history'),

  backupWeeklyData: (): Promise<string> => ipcRenderer.invoke('backup-weekly-data'),

  importBackup: (): Promise<{ imported: number; merged: number }> => ipcRenderer.invoke('import-backup'),

  updateDailySnapshot: (snapshot: { date: string; maxWeekly: number; maxSession: number; sessionAccum: number; sessionWindowCount: number }): Promise<void> =>
    ipcRenderer.invoke('update-daily-snapshot', snapshot),

  checkForUpdate: (): Promise<void> => ipcRenderer.invoke('check-for-update'),

  onNextPollAt: (cb: (nextPollAt: number) => void): void => {
    ipcRenderer.on('next-poll-at', (_event, nextPollAt: number) => cb(nextPollAt));
  },

  onLastResponse: (cb: (info: { ok: boolean; code?: number; message?: string; time: number }) => void): void => {
    ipcRenderer.on('last-response', (_event, info) => cb(info));
  },

  getDayTimeSeries: (date: string): Promise<import('./models/usageData').TimeSeriesPoint[]> =>
    ipcRenderer.invoke('get-day-timeseries', date),

  getSessionWindows: (): Promise<import('./models/usageData').SessionWindowRecord[]> =>
    ipcRenderer.invoke('get-session-windows'),

  getCurrentSessionWindow: (): Promise<import('./models/usageData').CurrentSessionWindow | null> =>
    ipcRenderer.invoke('get-current-session-window'),

  clearAllReportData: (): Promise<void> => ipcRenderer.invoke('clear-all-report-data'),

  deleteSessionWindow: (resetsAt: string): Promise<void> => ipcRenderer.invoke('delete-session-window', resetsAt),

  getCostEstimate: (): Promise<import('./services/costService').CostEstimate | null> =>
    ipcRenderer.invoke('get-cost-estimate'),

  chooseAutoBackupFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('choose-auto-backup-folder'),

  onProfileUpdated: (cb: (profile: ProfileData) => void): void => {
    ipcRenderer.on('profile-updated', (_event, profile: ProfileData) => cb(profile));
  },

  getCliSessions: (): Promise<import('./domain/entities/Usage').CliSession[]> =>
    ipcRenderer.invoke('get-cli-sessions'),

  getCliSessionTurns: (sessionId: string): Promise<import('./domain/entities/Usage').CliSessionTurn[]> =>
    ipcRenderer.invoke('get-cli-session-turns', sessionId),

  deleteAllCliSessions: (): Promise<boolean> =>
    ipcRenderer.invoke('delete-all-cli-sessions'),

  deleteCliSession: (sessionId: string): Promise<boolean> =>
    ipcRenderer.invoke('delete-cli-session', sessionId),

  sync: {
    getStatus: (): Promise<import('./services/syncService').SyncStatus> =>
      ipcRenderer.invoke('sync:get-status'),

    enable: (serverUrl: string, deviceLabel?: string): Promise<void> =>
      ipcRenderer.invoke('sync:enable', serverUrl, deviceLabel),

    disable: (wipeRemote?: boolean): Promise<void> =>
      ipcRenderer.invoke('sync:disable', wipeRemote),

    triggerNow: (): Promise<void> =>
      ipcRenderer.invoke('sync:trigger-now'),

    onEvent: (cb: (event: { type: string; payload: unknown }) => void): void => {
      ipcRenderer.on('sync-event', (_event, data: { type: string; payload: unknown }) => cb(data));
    },
  },

  server: {
    getStatus: (): Promise<import('./services/serverStatusService').ServerStatus> =>
      ipcRenderer.invoke('server:get-status'),

    connect: (): Promise<void> =>
      ipcRenderer.invoke('server:connect'),

    disconnect: (): Promise<void> =>
      ipcRenderer.invoke('server:disconnect'),

    getClientCount: (): Promise<number> =>
      ipcRenderer.invoke('server:get-client-count'),

    onStatusChange: (cb: (event: import('./services/serverStatusService').ServerStatusEvent) => void): void => {
      ipcRenderer.on('server:status-changed', (_event, data) => cb(data));
    },

    onClientCountChange: (cb: (count: number) => void): void => {
      ipcRenderer.on('server:client-count-changed', (_event, count) => cb(count));
    },
  },
});
