import { DailySnapshot, UsageData } from '../models/usageData';

export function updateDailySnapshot(
  dailyHistory: DailySnapshot[],
  today: string,
  data: UsageData,
  prevData: UsageData | null
): DailySnapshot[] {
  const weeklyPctInt  = Math.round(data.seven_day.utilization);
  const sessionPctInt = Math.round(data.five_hour.utilization);
  const extra = data.extra_usage;
  const creditsPctInt = (extra?.is_enabled && extra.monthly_limit > 0)
    ? Math.round((extra.used_credits / extra.monthly_limit) * 100)
    : undefined;

  // Detectar reset de sessão: resets_at avançou pelo menos 30min (evita falsos positivos
  // por variações mínimas no timestamp retornado pela API)
  let sessionResetOccurred = false;
  if (prevData) {
    const prevResetsAt = new Date(prevData.five_hour.resets_at).getTime();
    const currResetsAt = new Date(data.five_hour.resets_at).getTime();
    const THIRTY_MINUTES_MS = 30 * 60 * 1000;
    if (currResetsAt - prevResetsAt >= THIRTY_MINUTES_MS) {
      sessionResetOccurred = true;
    }
  }

  const existingDay = dailyHistory.find(d => d.date === today);

  if (existingDay) {
    if (sessionResetOccurred) {
      const peakOfCompletedWindow = Math.round(prevData!.five_hour.utilization);
      existingDay.sessionAccum  = (existingDay.sessionAccum  ?? 0) + peakOfCompletedWindow;
      existingDay.sessionResets = (existingDay.sessionResets ?? 1) + 1;
      existingDay.maxSession = sessionPctInt;
    } else {
      existingDay.maxSession = Math.max(existingDay.maxSession ?? 0, sessionPctInt);
    }
    existingDay.maxWeekly = Math.max(existingDay.maxWeekly, weeklyPctInt);
    if (creditsPctInt !== undefined) {
      existingDay.maxCredits = Math.max(existingDay.maxCredits ?? 0, creditsPctInt);
    }
  } else {
    dailyHistory.push({ date: today, maxWeekly: weeklyPctInt, maxSession: sessionPctInt, maxCredits: creditsPctInt, sessionResets: 1, sessionAccum: 0 });
  }

  dailyHistory.sort((a, b) => a.date.localeCompare(b.date));
  if (dailyHistory.length > 8) dailyHistory.splice(0, dailyHistory.length - 8);

  return dailyHistory;
}
