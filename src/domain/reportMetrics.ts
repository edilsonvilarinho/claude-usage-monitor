import { SessionWindow, CurrentSessionWindow, DailySnapshot } from './entities/Usage';

// ── Previsão de esgotamento ──────────────────────────────────────────────────

export interface ExhaustionForecast {
  daysLeft: number | null;
  avgDailyRate: number;
  hasData: boolean;
  alreadySaturated: boolean;
}

export function computeExhaustionForecast(dailyHistory: DailySnapshot[]): ExhaustionForecast {
  const sorted = [...dailyHistory].sort((a, b) => a.date.localeCompare(b.date));
  const noData: ExhaustionForecast = { daysLeft: null, avgDailyRate: 0, hasData: false, alreadySaturated: false };
  if (sorted.length < 2) return noData;
  const recent = sorted.slice(-14);
  const rates: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    const delta = recent[i].maxWeekly - recent[i - 1].maxWeekly;
    if (delta > 0) rates.push(delta);
  }
  if (rates.length === 0) return noData;
  const avgDailyRate = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
  const currentWeekly = recent[recent.length - 1].maxWeekly;
  if (currentWeekly >= 100) return { daysLeft: 0, avgDailyRate, hasData: true, alreadySaturated: true };
  const remaining = 100 - currentWeekly;
  const daysLeft = avgDailyRate > 0 ? Math.ceil(remaining / avgDailyRate) : null;
  return { daysLeft, avgDailyRate, hasData: true, alreadySaturated: false };
}

// ── Distribuição por hora do dia ─────────────────────────────────────────────

export function computeHourlyDistribution(
  windows: (SessionWindow | CurrentSessionWindow)[],
): number[] {
  const buckets = new Array(24).fill(0) as number[];
  for (const w of windows) {
    if (w.peakTs == null) continue;
    buckets[new Date(w.peakTs).getHours()]++;
  }
  return buckets;
}

// ── Streak de dias sem saturação ─────────────────────────────────────────────

export function computeNoSatStreak(dailyHistory: DailySnapshot[]): number {
  const sorted = [...dailyHistory].sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].maxSession < 100) streak++;
    else break;
  }
  return streak;
}

// ── Dias da semana com maior risco ───────────────────────────────────────────

export interface RiskDay {
  dayIndex: number;
  satCount: number;
  totalCount: number;
  pct: number;
}

export function computeRiskDays(
  windows: (SessionWindow | CurrentSessionWindow)[],
): RiskDay[] {
  const satByDay = new Array(7).fill(0) as number[];
  const totalByDay = new Array(7).fill(0) as number[];
  for (const w of windows) {
    if (w.peakTs == null) continue;
    const day = new Date(w.peakTs).getDay();
    totalByDay[day]++;
    if (w.peak >= 100) satByDay[day]++;
  }
  return Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i,
    satCount: satByDay[i],
    totalCount: totalByDay[i],
    pct: totalByDay[i] > 0 ? Math.round((satByDay[i] / totalByDay[i]) * 100) : 0,
  }))
    .filter(d => d.totalCount > 0)
    .sort((a, b) => b.pct - a.pct || b.satCount - a.satCount);
}

// ── Custo estimado de excesso ─────────────────────────────────────────────────

export interface ExcessCost {
  excessWindows: number;
  totalWindows: number;
  pct: number;
  avgExcess: number;
  hasData: boolean;
}

export function computeExcessCost(
  windows: (SessionWindow | CurrentSessionWindow)[],
): ExcessCost {
  const total = windows.length;
  if (total === 0) return { excessWindows: 0, totalWindows: 0, pct: 0, avgExcess: 0, hasData: false };
  const excessive = windows.filter(w => w.peak > 100);
  const excessWindows = excessive.length;
  const pct = Math.round((excessWindows / total) * 100);
  const avgExcess = excessWindows > 0
    ? Math.round(excessive.reduce((s, w) => s + (w.peak - 100), 0) / excessWindows)
    : 0;
  return { excessWindows, totalWindows: total, pct, avgExcess, hasData: true };
}

export interface SaturationRate {
  saturated: number;
  total: number;
  pct: number;
}

export function computeSaturationRate(
  windows: (SessionWindow | CurrentSessionWindow)[],
): SaturationRate {
  const total = windows.length;
  const saturated = windows.filter(w => w.peak >= 100).length;
  const pct = total > 0 ? Math.round((saturated / total) * 100) : 0;
  return { saturated, total, pct };
}

/** Returns a 7×3 grid: day (0=Sun..6=Sat) × period (0=morning, 1=afternoon, 2=night) */
export function computeHeatmap(
  windows: (SessionWindow | CurrentSessionWindow)[],
): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => [0, 0, 0]);
  for (const w of windows) {
    if (w.peakTs == null) continue;
    const d = new Date(w.peakTs);
    const day = d.getDay();
    const hour = d.getHours();
    const period = hour < 12 ? 0 : hour < 18 ? 1 : 2;
    grid[day][period]++;
  }
  return grid;
}

export interface WeeklyTrend {
  delta: number;
  direction: 'up' | 'down' | 'flat';
  avgLast: number;
  avgPrev: number;
  hasData: boolean;
}

export function computeWeeklyTrend(dailyHistory: DailySnapshot[]): WeeklyTrend {
  const sorted = [...dailyHistory].sort((a, b) => a.date.localeCompare(b.date));
  const noData: WeeklyTrend = { delta: 0, direction: 'flat', avgLast: 0, avgPrev: 0, hasData: false };
  if (sorted.length < 7) return noData;
  const last7 = sorted.slice(-7).map(d => d.maxSession);
  const prev7 = sorted.slice(-14, -7).map(d => d.maxSession);
  if (prev7.length === 0) return noData;
  const avgLast = Math.round(last7.reduce((a, b) => a + b, 0) / last7.length);
  const avgPrev = Math.round(prev7.reduce((a, b) => a + b, 0) / prev7.length);
  if (avgPrev === 0) return { delta: 0, direction: 'flat', avgLast, avgPrev, hasData: true };
  const delta = Math.round(((avgLast - avgPrev) / avgPrev) * 100);
  const direction = delta > 2 ? 'up' : delta < -2 ? 'down' : 'flat';
  return { delta: Math.abs(delta), direction, avgLast, avgPrev, hasData: true };
}
