import Store from 'electron-store';
import { UsageSnapshot, DailySnapshot, TimeSeriesPoint, SessionWindowRecord, CurrentSessionWindow } from '../models/usageData';

// ─── Per-account data (keyed by account email) ────────────────────────────────

export interface AccountData {
  usageHistory: UsageSnapshot[];
  dailyHistory: DailySnapshot[];
  rateLimitedUntil: number;
  rateLimitCount: number;
  rateLimitResetAt: number;
  /** Série temporal de polls por dia — chave YYYY-MM-DD, mantido por 7 dias */
  timeSeries: Record<string, TimeSeriesPoint[]>;
  /** Janelas de sessão de 5h completadas — usadas como marcadores e para sessionAccum */
  sessionWindows: SessionWindowRecord[];
  /** Estado da janela de sessão corrente — persistido para detectar resets após restart */
  currentSessionWindow: CurrentSessionWindow | null;
}

const accountDataDefaults: AccountData = {
  usageHistory: [],
  dailyHistory: [],
  rateLimitedUntil: 0,
  rateLimitCount: 0,
  rateLimitResetAt: 0,
  timeSeries: {},
  sessionWindows: [],
  currentSessionWindow: null,
};

interface AccountStore {
  activeAccount: string;
  accounts: Record<string, AccountData>;
}

const accountStore = new Store<AccountStore>({
  name: 'accounts',
  defaults: { activeAccount: '', accounts: {} },
});

export function setActiveAccount(email: string): void {
  if (!email) return;
  const current = accountStore.get('activeAccount', '');
  if (current === email) return;

  const accounts = accountStore.get('accounts', {}) as Record<string, AccountData>;

  if (!accounts[email]) {
    // First time seeing this account — migrate any existing legacy or "default" data
    const legacyStore = new Store<{ usageHistory?: UsageSnapshot[]; dailyHistory?: DailySnapshot[]; rateLimitedUntil?: number; rateLimitCount?: number; rateLimitResetAt?: number }>({ name: 'config' });
    const legacyHistory = (legacyStore.get('usageHistory', []) as UsageSnapshot[]);
    const legacyDaily = (legacyStore.get('dailyHistory', []) as DailySnapshot[]);
    const legacyRLUntil = legacyStore.get('rateLimitedUntil', 0) as number;
    const legacyRLCount = legacyStore.get('rateLimitCount', 0) as number;
    const legacyRLResetAt = legacyStore.get('rateLimitResetAt', 0) as number;

    const defaultData = accounts['default'];

    accounts[email] = {
      usageHistory: legacyHistory.length > 0 ? legacyHistory : (defaultData?.usageHistory ?? []),
      dailyHistory: legacyDaily.length > 0 ? legacyDaily : (defaultData?.dailyHistory ?? []),
      rateLimitedUntil: legacyRLUntil || (defaultData?.rateLimitedUntil ?? 0),
      rateLimitCount: legacyRLCount || (defaultData?.rateLimitCount ?? 0),
      rateLimitResetAt: legacyRLResetAt || (defaultData?.rateLimitResetAt ?? 0),
      timeSeries: defaultData?.timeSeries ?? {},
      sessionWindows: defaultData?.sessionWindows ?? [],
      currentSessionWindow: defaultData?.currentSessionWindow ?? null,
    };

    // Clear legacy top-level fields after migration
    legacyStore.set('usageHistory', []);
    legacyStore.set('dailyHistory', []);
    legacyStore.set('rateLimitedUntil', 0);
    legacyStore.set('rateLimitCount', 0);
    legacyStore.set('rateLimitResetAt', 0);

    // Remove default placeholder if it existed
    if (defaultData) delete accounts['default'];

    accountStore.set('accounts', accounts);
  }

  accountStore.set('activeAccount', email);
}

export function getActiveAccount(): string {
  return (accountStore.get('activeAccount', '') as string) || 'default';
}

export function getAccountData(): AccountData {
  const key = getActiveAccount();
  const accounts = accountStore.get('accounts', {}) as Record<string, AccountData>;
  return { ...accountDataDefaults, ...(accounts[key] ?? {}) };
}

export function saveAccountData(data: Partial<AccountData>): void {
  const key = getActiveAccount();
  const accounts = accountStore.get('accounts', {}) as Record<string, AccountData>;
  const current = accounts[key] ?? { ...accountDataDefaults };
  accounts[key] = { ...current, ...data };
  accountStore.set('accounts', accounts);
}

export interface NotificationSettings {
  enabled: boolean;
  sessionThreshold: number;  // 0-100 (%)
  weeklyThreshold: number;   // 0-100 (%)
  resetThreshold: number;    // usage must drop below this % to re-arm notification
  notifyOnReset: boolean;    // toast when usage drops back below resetThreshold
  notifyOnWindowReset: boolean; // toast when the 5h/weekly time window itself resets
  soundEnabled: boolean;     // play system beep with every notification
}

export interface AppSettings {
  launchAtStartup: boolean;
  alwaysVisible: boolean;
  notifications: NotificationSettings;
  theme: 'system' | 'dark' | 'light';
  language: 'en' | 'pt-BR';
  pollIntervalMinutes: number;
  windowSize: 'normal' | 'medium' | 'large' | 'xlarge';
  autoRefresh: boolean;
  autoRefreshInterval: number; // seconds
  rateLimitedUntil: number;    // unix ms — 0 means not rate limited
  rateLimitCount: number;      // consecutive 429s for backoff
  rateLimitResetAt: number;    // API-provided reset timestamp (unix ms), 0 if absent
  lastUpdateCheck: number;     // unix ms timestamp of last update check, 0 if never
  skippedVersion: string;      // version tag the user chose to skip
  usageHistory: UsageSnapshot[];
  showHistory: boolean;
  dailyHistory: DailySnapshot[];
  autoBackupMode: 'never' | 'before' | 'after' | 'always';
  autoBackupFolder: string;
  showDailyChart: boolean;
  showExtraBars:  boolean;
  showFooter:     boolean;
  showGeneralSettings: boolean;
  showNotifSettings:   boolean;
  showBackupSettings:  boolean;
  compactMode: boolean;
  essentialMode: boolean;
}

const defaults: AppSettings = {
  launchAtStartup: false,
  alwaysVisible: false,
  notifications: {
    enabled: true,
    sessionThreshold: 80,
    weeklyThreshold: 80,
    resetThreshold: 50,
    notifyOnReset: false,
    notifyOnWindowReset: true,
    soundEnabled: true,
  },
  theme: 'system',
  language: 'en',
  pollIntervalMinutes: 7,
  windowSize: 'large',
  autoRefresh: false,
  autoRefreshInterval: 600,
  rateLimitedUntil: 0,
  rateLimitCount: 0,
  rateLimitResetAt: 0,
  lastUpdateCheck: 0,
  skippedVersion: '',
  usageHistory: [],
  showHistory: false,
  dailyHistory: [],
  autoBackupMode: 'never',
  autoBackupFolder: '',
  showDailyChart: true,
  showExtraBars:  true,
  showFooter:     true,
  showGeneralSettings: true,
  showNotifSettings:   true,
  showBackupSettings:  true,
  compactMode: false,
  essentialMode: false,
};

const store = new Store<AppSettings>({
  name: 'config',
  defaults,
  schema: {
    launchAtStartup: { type: 'boolean' },
    alwaysVisible: { type: 'boolean' },
    notifications: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        sessionThreshold: { type: 'number', minimum: 0, maximum: 100 },
        weeklyThreshold: { type: 'number', minimum: 0, maximum: 100 },
        resetThreshold: { type: 'number', minimum: 0, maximum: 100 },
        notifyOnReset: { type: 'boolean' },
        notifyOnWindowReset: { type: 'boolean' },
        soundEnabled: { type: 'boolean' },
      },
    },
    theme: { type: 'string', enum: ['system', 'dark', 'light'] },
    language: { type: 'string', enum: ['en', 'pt-BR'] },
    pollIntervalMinutes: { type: 'number', minimum: 1, maximum: 60 },
    windowSize: { type: 'string', enum: ['normal', 'medium', 'large', 'xlarge'] },
    autoRefresh: { type: 'boolean' },
    autoRefreshInterval: { type: 'number', minimum: 1, maximum: 3600 },
    rateLimitedUntil: { type: 'number' },
    rateLimitCount: { type: 'number' },
    rateLimitResetAt: { type: 'number' },
    lastUpdateCheck: { type: 'number' },
    skippedVersion: { type: 'string' },
    usageHistory: { type: 'array' },
    showHistory: { type: 'boolean' },
    dailyHistory: { type: 'array' },
    autoBackupMode: { type: 'string', enum: ['never', 'before', 'after', 'always'] },
    autoBackupFolder: { type: 'string' },
    showDailyChart: { type: 'boolean' },
    showExtraBars:  { type: 'boolean' },
    showFooter:     { type: 'boolean' },
    showGeneralSettings: { type: 'boolean' },
    showNotifSettings:   { type: 'boolean' },
    showBackupSettings:  { type: 'boolean' },
    compactMode: { type: 'boolean' },
    essentialMode: { type: 'boolean' },
  },
});

export function getSettings(): AppSettings {
  return {
    launchAtStartup: store.get('launchAtStartup', defaults.launchAtStartup),
    alwaysVisible: store.get('alwaysVisible', defaults.alwaysVisible),
    notifications: store.get('notifications', defaults.notifications),
    theme: store.get('theme', defaults.theme),
    language: store.get('language', defaults.language),
    pollIntervalMinutes: store.get('pollIntervalMinutes', defaults.pollIntervalMinutes),
    windowSize: store.get('windowSize', defaults.windowSize),
    autoRefresh: store.get('autoRefresh', defaults.autoRefresh),
    autoRefreshInterval: store.get('autoRefreshInterval', defaults.autoRefreshInterval),
    rateLimitedUntil: store.get('rateLimitedUntil', defaults.rateLimitedUntil),
    rateLimitCount: store.get('rateLimitCount', defaults.rateLimitCount),
    rateLimitResetAt: store.get('rateLimitResetAt', defaults.rateLimitResetAt),
    lastUpdateCheck: store.get('lastUpdateCheck', defaults.lastUpdateCheck),
    skippedVersion: store.get('skippedVersion', defaults.skippedVersion),
    usageHistory: store.get('usageHistory', defaults.usageHistory),
    showHistory: store.get('showHistory', defaults.showHistory),
    dailyHistory: store.get('dailyHistory', defaults.dailyHistory),
    autoBackupMode: store.get('autoBackupMode', defaults.autoBackupMode),
    autoBackupFolder: store.get('autoBackupFolder', defaults.autoBackupFolder),
    showDailyChart: store.get('showDailyChart', defaults.showDailyChart),
    showExtraBars:  store.get('showExtraBars',  defaults.showExtraBars),
    showFooter:     store.get('showFooter',     defaults.showFooter),
    showGeneralSettings: store.get('showGeneralSettings', defaults.showGeneralSettings),
    showNotifSettings:   store.get('showNotifSettings',   defaults.showNotifSettings),
    showBackupSettings:  store.get('showBackupSettings',  defaults.showBackupSettings),
    compactMode: store.get('compactMode', defaults.compactMode),
    essentialMode: store.get('essentialMode', defaults.essentialMode),
  };
}

export function saveSettings(settings: Partial<AppSettings>): void {
  if (settings.launchAtStartup !== undefined) {
    store.set('launchAtStartup', settings.launchAtStartup);
  }
  if (settings.alwaysVisible !== undefined) {
    store.set('alwaysVisible', settings.alwaysVisible);
  }
  if (settings.notifications !== undefined) {
    store.set('notifications', settings.notifications);
  }
  if (settings.theme !== undefined) {
    store.set('theme', settings.theme);
  }
  if (settings.language !== undefined) {
    store.set('language', settings.language);
  }
  if (settings.pollIntervalMinutes !== undefined) {
    store.set('pollIntervalMinutes', settings.pollIntervalMinutes);
  }
  if (settings.windowSize !== undefined) {
    store.set('windowSize', settings.windowSize);
  }
  if (settings.autoRefresh !== undefined) {
    store.set('autoRefresh', settings.autoRefresh);
  }
  if (settings.autoRefreshInterval !== undefined) {
    store.set('autoRefreshInterval', settings.autoRefreshInterval);
  }
  if (settings.rateLimitedUntil !== undefined) {
    store.set('rateLimitedUntil', settings.rateLimitedUntil);
  }
  if (settings.rateLimitCount !== undefined) {
    store.set('rateLimitCount', settings.rateLimitCount);
  }
  if (settings.rateLimitResetAt !== undefined) {
    store.set('rateLimitResetAt', settings.rateLimitResetAt);
  }
  if (settings.lastUpdateCheck !== undefined) {
    store.set('lastUpdateCheck', settings.lastUpdateCheck);
  }
  if (settings.skippedVersion !== undefined) {
    store.set('skippedVersion', settings.skippedVersion);
  }
  if (settings.usageHistory !== undefined) store.set('usageHistory', settings.usageHistory);
  if (settings.showHistory !== undefined) store.set('showHistory', settings.showHistory);
  if (settings.dailyHistory !== undefined) store.set('dailyHistory', settings.dailyHistory);
  if (settings.autoBackupMode !== undefined) store.set('autoBackupMode', settings.autoBackupMode);
  if (settings.autoBackupFolder !== undefined) store.set('autoBackupFolder', settings.autoBackupFolder);
  if (settings.showDailyChart !== undefined) store.set('showDailyChart', settings.showDailyChart);
  if (settings.showExtraBars  !== undefined) store.set('showExtraBars',  settings.showExtraBars);
  if (settings.showFooter     !== undefined) store.set('showFooter',     settings.showFooter);
  if (settings.showGeneralSettings !== undefined) store.set('showGeneralSettings', settings.showGeneralSettings);
  if (settings.showNotifSettings   !== undefined) store.set('showNotifSettings',   settings.showNotifSettings);
  if (settings.showBackupSettings  !== undefined) store.set('showBackupSettings',  settings.showBackupSettings);
  if (settings.compactMode !== undefined) store.set('compactMode', settings.compactMode);
  if (settings.essentialMode !== undefined) store.set('essentialMode', settings.essentialMode);
}
