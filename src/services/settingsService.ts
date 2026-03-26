import Store from 'electron-store';

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
  autoRefreshInterval: 300,
  rateLimitedUntil: 0,
  rateLimitCount: 0,
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
}
