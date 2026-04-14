import { UsageData } from '../domain/entities/Usage';
import { AppSettings } from '../domain/entities/Settings';

export interface ApiUsageResponse {
  five_hour: { utilization: number; resets_at: string };
  seven_day: { utilization: number; resets_at: string };
  seven_day_sonnet?: { utilization: number; resets_at: string };
  sonnet_only?: { utilization: number; resets_at: string };
  extra_usage?: { is_enabled: boolean; monthly_limit: number; used_credits: number };
}

export function mapApiToUsage(response: ApiUsageResponse): UsageData {
  return {
    sessionUsage: {
      utilization: response.five_hour.utilization,
      resetsAt: response.five_hour.resets_at,
    },
    weeklyUsage: {
      utilization: response.seven_day.utilization,
      resetsAt: response.seven_day.resets_at,
    },
    sonnetUsage: response.seven_day_sonnet,
    sonnetOnly: response.sonnet_only,
    extraUsage: response.extra_usage ? {
      isEnabled: response.extra_usage.is_enabled,
      monthlyLimit: response.extra_usage.monthly_limit,
      usedCredits: response.extra_usage.used_credits,
    } : undefined,
  };
}

export interface ApiSettings {
  theme: 'system' | 'dark' | 'light';
  language: 'en' | 'pt-BR';
  windowSize: 'normal' | 'medium' | 'large' | 'xlarge';
  pollIntervalMinutes: number;
}

export function mapAppToApiSettings(settings: AppSettings): ApiSettings {
  return {
    theme: settings.theme,
    language: settings.language,
    windowSize: settings.windowSize,
    pollIntervalMinutes: settings.pollIntervalMinutes,
  };
}

export function mapApiToAppSettings(api: ApiSettings, current: AppSettings): AppSettings {
  return {
    ...current,
    ...api,
  };
}