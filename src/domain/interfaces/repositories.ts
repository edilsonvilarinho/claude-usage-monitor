import { UsageData } from '../entities/Usage';
import { AppSettings, NotificationSettings, WorkSchedule, CloudSyncSettings } from '../entities/Settings';
import { CostEstimate, CostModel } from '../entities/Cost';

export interface IUsageApiRepository {
  fetchUsage(): Promise<UsageData>;
}

export interface ISettingsRepository {
  getSettings(): AppSettings;
  saveSettings(settings: Partial<AppSettings>): void;
  getNotificationSettings(): NotificationSettings;
  saveNotificationSettings(settings: NotificationSettings): void;
  getWorkSchedule(): WorkSchedule;
  saveWorkSchedule(schedule: WorkSchedule): void;
  getCloudSyncSettings(): CloudSyncSettings;
  saveCloudSyncSettings(settings: CloudSyncSettings): void;
}

export interface ICredentialsRepository {
  getCredentials(): { accessToken: string; refreshToken: string; expiresAt: number } | null;
  refreshCredentials(): Promise<boolean>;
}

export interface INotificationRepository {
  showNotification(title: string, body: string): void;
}

export interface IPollingRepository {
  start(): void;
  stop(): void;
  triggerNow(): void;
  setInterval(minutes: number): void;
  restoreRateLimit(until: number, count: number): void;
}

export interface ISyncRepository {
  getStatus(): Promise<{ enabled: boolean; lastSyncAt: number; pendingOps: number }>;
  enable(serverUrl: string, deviceLabel?: string): Promise<void>;
  disable(wipeRemote?: boolean): Promise<void>;
  triggerNow(): Promise<void>;
}

export interface ICostRepository {
  calculateCost(model: CostModel, inputTokens: number, outputTokens: number): CostEstimate;
}

export interface ISmartScheduleRepository {
  getStatus(): { status: 'green' | 'yellow' | 'red' | 'blue' | 'purple'; message: string };
  getWorkHours(): { start: string; end: string; breakStart: string; breakEnd: string };
}