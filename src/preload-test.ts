/**
 * Preload de testes E2E — substitui o preload real quando NODE_ENV=test.
 *
 * Expõe window.claudeUsage como mock completo via contextBridge.
 * O mock lê as settings de process.argv (passadas pelo electron.launch args).
 *
 * ATENÇÃO: este arquivo é SOMENTE para testes. Nunca é bundlado no build de produção.
 */
import { contextBridge } from 'electron';

// Ler settings injetadas via args do electron.launch
// Formato: --test-settings=<JSON encodado em base64>
function readTestSettings(): Record<string, unknown> {
  const arg = process.argv.find((a) => a.startsWith('--test-settings='));
  if (!arg) return {};
  try {
    const b64 = arg.replace('--test-settings=', '');
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  } catch {
    return {};
  }
}

const DEFAULT_SETTINGS = {
  theme: 'dark',
  language: 'en',
  pollIntervalMinutes: 10,
  windowSize: 'large',
  autoRefresh: false,
  autoRefreshInterval: 600,
  launchAtStartup: false,
  alwaysVisible: false,
  showHistory: true,
  showDailyChart: true,
  showExtraBars: true,
  showFooter: true,
  compactMode: false,
  essentialMode: false,
  monthlyBudget: 50,
  costModel: 'sonnet',
  autoBackupMode: 'never',
  autoBackupFolder: '',
  notifications: {
    enabled: true,
    sessionThreshold: 80,
    weeklyThreshold: 80,
    resetThreshold: 50,
    notifyOnReset: false,
    notifyOnWindowReset: true,
    soundEnabled: true,
  },
  cloudSync: {
    enabled: false,
    serverUrl: '',
    deviceId: '',
    deviceLabel: '',
    lastSyncAt: 0,
    lastSyncError: '',
    lastPullCursor: 0,
    syncIntervalMinutes: 15,
  },
  workSchedule: {
    activeDays: [1, 2, 3, 4, 5],
    startHour: 8,
    startMinute: 0,
    endHour: 18,
    endMinute: 0,
    breakStartHour: 12,
    breakStartMinute: 0,
    breakEndHour: 13,
    breakEndMinute: 0,
  },
};

const rawSettings = readTestSettings();
const testSettings = { ...DEFAULT_SETTINGS, ...rawSettings };

// Dados mockáveis passados via _mockData no settingsOverride
const mockData = (rawSettings as Record<string, unknown>)._mockData as Record<string, unknown> ?? {};

// Estado do mock — compartilhado via window
const mockState = {
  calls: {
    saveSettings: [] as unknown[],
    closeWindow: [] as unknown[],
    startOAuthLogin: [] as unknown[],
    forceRefreshNow: [] as unknown[],
    downloadUpdate: [] as unknown[],
    dismissUpdate: [] as unknown[],
    chooseAutoBackupFolder: [] as unknown[],
    syncEnable: [] as unknown[],
    syncDisable: [] as unknown[],
  },
  handlers: {} as Record<string, (...args: unknown[]) => void>,
};

// Expor funções (não dados) para que o contextBridge não faça clone estático
contextBridge.exposeInMainWorld('__mockState', {
  // Retorna snapshot ao vivo das chamadas (serializado para cruzar o contextBridge)
  getCalls: () => ({
    saveSettings: [...mockState.calls.saveSettings],
    closeWindow: [...mockState.calls.closeWindow],
    startOAuthLogin: [...mockState.calls.startOAuthLogin],
    forceRefreshNow: [...mockState.calls.forceRefreshNow],
    downloadUpdate: [...mockState.calls.downloadUpdate],
    dismissUpdate: [...mockState.calls.dismissUpdate],
    chooseAutoBackupFolder: [...mockState.calls.chooseAutoBackupFolder],
    syncEnable: [...mockState.calls.syncEnable],
    syncDisable: [...mockState.calls.syncDisable],
  }),
  // Atalhos de contagem para os testes
  getCloseWindowCount: () => mockState.calls.closeWindow.length,
  getSaveSettingsCount: () => mockState.calls.saveSettings.length,
  getForceRefreshCount: () => mockState.calls.forceRefreshNow.length,
  getChooseBackupFolderCount: () => mockState.calls.chooseAutoBackupFolder.length,
  getSyncEnableCount: () => mockState.calls.syncEnable.length,
  getSyncDisableCount: () => mockState.calls.syncDisable.length,
  getLastSaveSettings: () => mockState.calls.saveSettings[mockState.calls.saveSettings.length - 1] ?? null,
});

contextBridge.exposeInMainWorld('__emit', (event: string, ...args: unknown[]) => {
  const cb = mockState.handlers[event];
  if (cb) cb(...args);
});

contextBridge.exposeInMainWorld('claudeUsage', {
  // --- Invokes ---
  getSettings: () => Promise.resolve(testSettings),
  saveSettings: (s: unknown) => {
    mockState.calls.saveSettings.push(s);
    return Promise.resolve();
  },
  getAppVersion: () => Promise.resolve('18.0.0-test'),
  getProfile: () => Promise.resolve(null),
  getDailyHistory: () => Promise.resolve(mockData.dailyHistory ?? []),
  getDayTimeSeries: (_date: string) => Promise.resolve(mockData.dailyTimeSeries ?? []),
  getSessionWindows: () => Promise.resolve([]),
  getCurrentSessionWindow: () => Promise.resolve(null),
  getCostEstimate: () => Promise.resolve(mockData.costEstimate ?? null),
  refreshNow: () => Promise.resolve(),
  forceRefreshNow: () => {
    mockState.calls.forceRefreshNow.push(Date.now());
    return Promise.resolve();
  },
  startOAuthLogin: () => {
    mockState.calls.startOAuthLogin.push(Date.now());
    return Promise.resolve();
  },
  saveManualCredentials: () => Promise.resolve({ success: true }),
  getUsageHistory: () => Promise.resolve([]),
  clearDailyHistory: () => Promise.resolve(),
  backupWeeklyData: () => Promise.resolve(''),
  importBackup: () => Promise.resolve({ imported: 0, merged: 0 }),
  chooseAutoBackupFolder: () => {
    mockState.calls.chooseAutoBackupFolder.push(Date.now());
    return Promise.resolve(null);
  },
  clearAllReportData: () => Promise.resolve(),
  deleteSessionWindow: () => Promise.resolve(),
  updateDailySnapshot: () => Promise.resolve(),
  setPollInterval: () => Promise.resolve(),
  setStartup: () => Promise.resolve(),
  checkForUpdate: () => Promise.resolve(),
  downloadUpdate: () => {
    mockState.calls.downloadUpdate.push(Date.now());
    return Promise.resolve();
  },
  testNotification: () => Promise.resolve(),

  // --- Fire-and-forget ---
  sendTrayIcon: () => {},
  closeWindow: () => {
    mockState.calls.closeWindow.push(Date.now());
  },
  setWindowHeight: () => {},
  openReleaseUrl: () => {},
  dismissUpdate: () => {
    mockState.calls.dismissUpdate.push(Date.now());
  },

  // --- Event listeners ---
  onUsageUpdated: (cb: (...args: unknown[]) => void) => { mockState.handlers['usage'] = cb; },
  onError: (cb: (...args: unknown[]) => void) => { mockState.handlers['error'] = cb; },
  onRateLimited: (cb: (...args: unknown[]) => void) => { mockState.handlers['rateLimited'] = cb; },
  onSmartStatusUpdated: (cb: (...args: unknown[]) => void) => { mockState.handlers['smartStatus'] = cb; },
  onUpdateAvailable: (cb: (...args: unknown[]) => void) => { mockState.handlers['update'] = cb; },
  onUpdateDownloadProgress: (cb: (...args: unknown[]) => void) => { mockState.handlers['dlProgress'] = cb; },
  onCredentialMissing: (cb: (...args: unknown[]) => void) => { mockState.handlers['credMissing'] = cb; },
  onCredentialsExpired: (cb: (...args: unknown[]) => void) => { mockState.handlers['credExpired'] = cb; },
  onOAuthLoginComplete: (cb: (...args: unknown[]) => void) => { mockState.handlers['oauthOk'] = cb; },
  onOAuthLoginError: (cb: (...args: unknown[]) => void) => { mockState.handlers['oauthErr'] = cb; },
  onProfileUpdated: (cb: (...args: unknown[]) => void) => { mockState.handlers['profile'] = cb; },
  onNextPollAt: (cb: (...args: unknown[]) => void) => { mockState.handlers['nextPoll'] = cb; },
  onLastResponse: (cb: (...args: unknown[]) => void) => { mockState.handlers['lastResp'] = cb; },

  // --- Sync namespace ---
  sync: {
    getStatus: () => {
      const cs = (testSettings as Record<string, unknown>).cloudSync as Record<string, unknown> | undefined;
      const enabled = cs?.enabled === true;
      return Promise.resolve({
        enabled,
        lastSyncAt: (cs?.lastSyncAt as number) ?? 0,
        lastError: '',
        pendingOps: 0,
        jwtExpiresAt: 0,
        email: (cs?.deviceLabel as string) ?? '',
      });
    },
    enable: (...args: unknown[]) => {
      mockState.calls.syncEnable.push(args);
      return Promise.resolve();
    },
    disable: (...args: unknown[]) => {
      mockState.calls.syncDisable.push(args);
      return Promise.resolve();
    },
    triggerNow: () => Promise.resolve(),
    onEvent: (cb: (...args: unknown[]) => void) => { mockState.handlers['syncEvent'] = cb; },
  },

  // --- Server namespace ---
  server: {
    getStatus: () => Promise.resolve({ status: 'disconnected', clientCount: 0 }),
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    getClientCount: () => Promise.resolve(0),
    onStatusChange: (cb: (...args: unknown[]) => void) => { mockState.handlers['serverStatus'] = cb; },
    onClientCountChange: (cb: (...args: unknown[]) => void) => { mockState.handlers['clientCount'] = cb; },
  },
});
