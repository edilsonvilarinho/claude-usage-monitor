import { UsageData, UsageWindow } from '../domain/entities/Usage';
import { fetchUsage } from '../services/usageApiService';
import { getSettings, saveSettings } from '../services/settingsService';
import { NotificationSettings } from '../services/settingsService';
import { showNotification } from '../services/notificationService';
import { mapApiToUsage } from './entityMapper';

export async function getCurrentUsage(): Promise<UsageData> {
  const apiResponse = await fetchUsage();
  return mapApiToUsage(apiResponse);
}

export function calculateUsagePercentage(window: UsageWindow): { value: number; isCritical: boolean; isWarning: boolean } {
  const value = window.utilization;
  return {
    value,
    isCritical: value >= 80,
    isWarning: value >= 60 && value < 80,
  };
}

export function getTimeUntilReset(window: UsageWindow): number {
  const resetsAt = new Date(window.resetsAt).getTime();
  const now = Date.now();
  return Math.max(0, resetsAt - now);
}

export function formatTimeRemaining(ms: number): { days: number; hours: number; minutes: number } {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes };
}

export function shouldNotify(sessionPct: number, settings: NotificationSettings): boolean {
  if (!settings.enabled) return false;
  if (sessionPct >= settings.sessionThreshold) return true;
  return false;
}

export function sendUsageAlert(type: 'session' | 'weekly', percentage: number): void {
  const settings = getSettings();
  const threshold = type === 'session' 
    ? settings.notifications.sessionThreshold 
    : settings.notifications.weeklyThreshold;

  showNotification(
    `${type === 'session' ? 'Sessão' : 'Semanal'} em ${percentage}%`,
    `Uso atingiu ${percentage}% do limite de ${threshold}%`
  );
}

export interface UpdateSettingsInput {
  theme?: 'system' | 'dark' | 'light';
  language?: 'en' | 'pt-BR';
  windowSize?: 'normal' | 'medium' | 'large' | 'xlarge';
  autoRefresh?: boolean;
  autoRefreshInterval?: number;
}

export function updateAppSettings(input: UpdateSettingsInput): void {
  const current = getSettings();
  saveSettings({ ...current, ...input });
}

export function enableNotifications(enabled: boolean): void {
  const current = getSettings();
  saveSettings({
    ...current,
    notifications: {
      ...current.notifications,
      enabled,
    },
  });
}

export function setNotificationThresholds(session: number, weekly: number): void {
  const current = getSettings();
  saveSettings({
    ...current,
    notifications: {
      ...current.notifications,
      sessionThreshold: session,
      weeklyThreshold: weekly,
    },
  });
}