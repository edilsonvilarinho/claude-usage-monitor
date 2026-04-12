/** Tipos compartilhados entre o cliente Electron e o servidor Hono */

export interface WorkSchedule {
  enabled: boolean;
  activeDays: number[];
  workStart: string;
  workEnd: string;
  breakStart: string;
  breakEnd: string;
}

export interface SyncNotifications {
  enabled?: boolean;
  sessionThreshold?: number;
  weeklyThreshold?: number;
  resetThreshold?: number;
  notifyOnReset?: boolean;
  notifyOnWindowReset?: boolean;
  soundEnabled?: boolean;
}

export interface SyncDailySnapshot {
  date: string;              // YYYY-MM-DD
  maxWeekly: number;
  maxSession: number;
  maxCredits?: number;
  sessionWindowCount: number;
  sessionAccum: number;
  updatedAt: number;         // unix ms
  updatedByDevice: string;   // deviceId
}

export interface SyncSessionWindow {
  date: string;              // YYYY-MM-DD
  resetsAt: string;          // ISO datetime
  resetsAtMinute: number;    // floor(ts / 60000)
  peak: number;
  updatedAt: number;         // unix ms
}

export interface SyncTimeSeriesPoint {
  ts: number;                // unix ms (chave primária)
  date: string;              // YYYY-MM-DD
  session: number;
  weekly: number;
  credits?: number;
}

export interface SyncUsageSnapshot {
  ts: number;                // unix ms (chave primária)
  session: number;
  weekly: number;
}

export interface SyncCurrentWindow {
  resetsAt: string;          // ISO datetime
  peak: number;
  updatedAt: number;         // unix ms
}

export interface SyncSettings {
  theme?: 'system' | 'dark' | 'light';
  language?: 'en' | 'pt-BR';
  notifications?: SyncNotifications;
  workSchedule?: WorkSchedule;
  updatedAt: number;         // unix ms
}

/** Payload enviado no POST /sync/push */
export interface SyncPushPayload {
  deviceId: string;
  daily: SyncDailySnapshot[];
  sessionWindows: SyncSessionWindow[];
  timeSeries: SyncTimeSeriesPoint[];
  usageSnapshots: SyncUsageSnapshot[];
  currentWindow?: SyncCurrentWindow;
  settings?: SyncSettings;
}

/** Resposta do GET /sync/pull */
export interface SyncPullResponse {
  daily: SyncDailySnapshot[];
  sessionWindows: SyncSessionWindow[];
  timeSeries: SyncTimeSeriesPoint[];
  usageSnapshots: SyncUsageSnapshot[];
  currentWindow?: SyncCurrentWindow;
  settings?: SyncSettings;
  serverTime: number;        // unix ms
}

/** Request do POST /auth/exchange */
export interface AuthExchangeRequest {
  accessToken: string;
  deviceId: string;
  deviceLabel?: string;
}

/** Resposta do POST /auth/exchange */
export interface AuthExchangeResponse {
  jwt: string;
  expiresAt: number;         // unix ms
  email: string;
}

/** Status retornado via IPC sync:get-status */
export interface SyncStatus {
  enabled: boolean;
  lastSyncAt: number;
  lastError: string;
  pendingOps: number;
  jwtExpiresAt: number;
  email: string;
}
