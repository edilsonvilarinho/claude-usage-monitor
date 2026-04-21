import { SessionWindow, CurrentSessionWindow, DailySnapshot } from './entities/Usage';

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
