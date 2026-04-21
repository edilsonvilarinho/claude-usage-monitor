export interface DailySnapshot {
  date: string;
  maxWeekly: number;
  maxSession: number;
  sessionWindowCount?: number;
  sessionAccum?: number;
}

// 3 dias passados com dados reais — não são "future", então .daily-col será clicável
export const DAILY_HISTORY_3DAYS: DailySnapshot[] = [
  { date: '2026-04-20', maxWeekly: 72, maxSession: 45, sessionWindowCount: 1, sessionAccum: 0 },
  { date: '2026-04-19', maxWeekly: 60, maxSession: 80, sessionWindowCount: 2, sessionAccum: 75 },
  { date: '2026-04-18', maxWeekly: 50, maxSession: 35, sessionWindowCount: 1, sessionAccum: 0 },
];
