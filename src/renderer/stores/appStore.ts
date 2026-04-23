import { createStore } from './store';

interface AppState {
  lastWeeklyResetsAt: string | null;
  lastSessionPct: number | null;
  lastWeeklyPct: number | null;
  lastUpdatedTime: string | null;
  currentDailyHistory: { date: string; maxWeekly: number; maxSession: number; maxCredits?: number; sessionWindowCount?: number; sessionAccum?: number }[];
  currentSmartStatus: import('../globals').SmartStatus | null;
  autoRefreshEnabled: boolean;
  autoRefreshIntervalMs: number;
  isRateLimited: boolean;
  showAccountBar: boolean;
  extraSectionAllowed: boolean;
}

export const appStore = createStore<AppState>({
  lastWeeklyResetsAt: null,
  lastSessionPct: null,
  lastWeeklyPct: null,
  lastUpdatedTime: null,
  currentDailyHistory: [],
  currentSmartStatus: null,
  autoRefreshEnabled: false,
  autoRefreshIntervalMs: 300 * 1000,
  isRateLimited: false,
  showAccountBar: false,
  extraSectionAllowed: true,
});
