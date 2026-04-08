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

  onUpdateAvailable: (cb: (info: { version: string; url: string }) => void): void => {
    ipcRenderer.on('update-available', (_event, info: { version: string; url: string }) => cb(info));
  },

  openReleaseUrl: (url: string): void => {
    ipcRenderer.send('open-release-url', url);
  },

  onCredentialMissing: (cb: (credPath: string) => void): void => {
    ipcRenderer.on('credential-missing', (_e, credPath: string) => cb(credPath));
  },

  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),

  getProfile: (): Promise<ProfileData | null> => ipcRenderer.invoke('get-profile'),

  setPollInterval: (ms: number | null): Promise<void> => ipcRenderer.invoke('set-poll-interval', ms),

  getUsageHistory: (): Promise<import('./models/usageData').UsageSnapshot[]> => ipcRenderer.invoke('get-usage-history'),

  getDailyHistory: (): Promise<import('./models/usageData').DailySnapshot[]> => ipcRenderer.invoke('get-daily-history'),

  clearDailyHistory: (): Promise<void> => ipcRenderer.invoke('clear-daily-history'),

  backupWeeklyData: (): Promise<string> => ipcRenderer.invoke('backup-weekly-data'),

  importBackup: (): Promise<{ imported: number; merged: number }> => ipcRenderer.invoke('import-backup'),

  updateDailySnapshot: (snapshot: { date: string; maxWeekly: number; maxSession: number; sessionAccum: number; sessionResets: number }): Promise<void> =>
    ipcRenderer.invoke('update-daily-snapshot', snapshot),

  onNextPollAt: (cb: (nextPollAt: number) => void): void => {
    ipcRenderer.on('next-poll-at', (_event, nextPollAt: number) => cb(nextPollAt));
  },

  onLastResponse: (cb: (info: { ok: boolean; code?: number; message?: string; time: number }) => void): void => {
    ipcRenderer.on('last-response', (_event, info) => cb(info));
  },
});
