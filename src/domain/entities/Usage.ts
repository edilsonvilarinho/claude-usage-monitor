export interface UsageSnapshot {
  ts: number;
  session: number;
  weekly: number;
}

export interface TimeSeriesPoint {
  ts: number;
  session: number;
  weekly: number;
  credits?: number;
}

export interface SessionWindow {
  resetsAt: string;
  peak: number;
  final: number;
  date: string;
  peakTs?: number;
}

export interface CurrentSessionWindow {
  resetsAt: string;
  peak: number;
  final: number;
  date?: string;
  peakTs?: number;
}

export interface DailySnapshot {
  date: string;
  maxWeekly: number;
  maxSession: number;
  maxCredits?: number;
  sessionWindowCount?: number;
  sessionAccum?: number;
}

export interface UsageWindow {
  utilization: number;
  resetsAt: string;
}

export const SessionUsage = UsageWindow;
export const WeeklyUsage = UsageWindow;

export interface ExtraUsage {
  isEnabled: boolean;
  monthlyLimit: number;
  usedCredits: number;
}

export interface UsageData {
  sessionUsage: UsageWindow;
  weeklyUsage: UsageWindow;
  sonnetUsage?: UsageWindow;
  sonnetOnly?: UsageWindow;
  extraUsage?: ExtraUsage;
}

export interface CliSession {
  sessionId: string;
  toolName: string;
  ts: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface ProfileData {
  account: {
    displayName: string;
    email: string;
    hasClaudePro: boolean;
    hasClaudeMax: boolean;
  };
}