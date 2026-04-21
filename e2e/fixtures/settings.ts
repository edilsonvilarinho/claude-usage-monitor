/**
 * Fixtures de AppSettings para testes E2E.
 */

export const defaultSettings = {
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

export const ptBrSettings = {
  ...defaultSettings,
  language: 'pt-BR',
};
