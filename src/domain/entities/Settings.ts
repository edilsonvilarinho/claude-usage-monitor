export interface NotificationSettings {
  enabled: boolean;
  sessionThreshold: number;
  weeklyThreshold: number;
  resetThreshold: number;
  notifyOnReset: boolean;
  notifyOnWindowReset: boolean;
  soundEnabled: boolean;
}

export interface WorkSchedule {
  enabled: boolean;
  activeDays: number[];
  workStart: string;
  workEnd: string;
  breakStart: string;
  breakEnd: string;
}

export type Theme = 'system' | 'dark' | 'light';
export type Language = 'en' | 'pt-BR';
export type WindowSize = 'normal' | 'medium' | 'large' | 'xlarge';
export type AutoBackupMode = 'never' | 'before' | 'after' | 'always';
export type CostModel = 'sonnet' | 'haiku' | 'opus';

export interface AppSettings {
  launchAtStartup: boolean;
  alwaysVisible: boolean;
  notifications: NotificationSettings;
  theme: Theme;
  language: Language;
  pollIntervalMinutes: number;
  windowSize: WindowSize;
  autoRefresh: boolean;
  autoRefreshInterval: number;
  rateLimitedUntil: number;
  rateLimitCount: number;
  rateLimitResetAt: number;
  lastUpdateCheck: number;
  skippedVersion: string;
  usageHistory: { ts: number; session: number; weekly: number }[];
  showHistory: boolean;
  dailyHistory: { date: string; maxWeekly: number; maxSession: number; maxCredits?: number; sessionWindowCount?: number; sessionAccum?: number }[];
  autoBackupMode: AutoBackupMode;
  autoBackupFolder: string;
  showDailyChart: boolean;
  showExtraBars: boolean;
  showFooter: boolean;
  showGeneralSettings: boolean;
  showNotifSettings: boolean;
  showBackupSettings: boolean;
  compactMode: boolean;
  essentialMode: boolean;
  settingsUpdatedAt: number;
  cloudSync: CloudSyncSettings;
  showCloudSyncSettings: boolean;
  workSchedule: WorkSchedule;
  monthlyBudget: number;
  costModel: CostModel;
}

export interface CloudSyncSettings {
  enabled: boolean;
  serverUrl: string;
  deviceLabel: string;
  lastSyncAt: number;
  lastSyncError: string;
  deviceId: string;
  jwt: string;
  jwtExpiresAt: number;
}