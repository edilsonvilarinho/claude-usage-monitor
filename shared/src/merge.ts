import type {
  SyncDailySnapshot,
  SyncSessionWindow,
  SyncCurrentWindow,
  SyncTimeSeriesPoint,
  SyncUsageSnapshot,
} from './syncTypes';

/** Arredonda um timestamp unix-ms para o minuto mais próximo (truncado) */
export function toMinuteTs(ts: number): number {
  return Math.floor(ts / 60000) * 60000;
}

/**
 * Merge field-by-field de DailySnapshots.
 * Todos os campos numéricos tomam o valor máximo.
 * Comutativo, idempotente e associativo.
 */
export function mergeDailySnapshots(
  a: SyncDailySnapshot[],
  b: SyncDailySnapshot[],
): SyncDailySnapshot[] {
  const map = new Map<string, SyncDailySnapshot>();

  for (const snap of a) {
    map.set(snap.date, { ...snap });
  }

  for (const snap of b) {
    const existing = map.get(snap.date);
    if (!existing) {
      map.set(snap.date, { ...snap });
    } else {
      const merged: SyncDailySnapshot = {
        date: snap.date,
        maxWeekly: Math.max(existing.maxWeekly, snap.maxWeekly),
        maxSession: Math.max(existing.maxSession, snap.maxSession),
        sessionWindowCount: Math.max(existing.sessionWindowCount, snap.sessionWindowCount),
        sessionAccum: Math.max(existing.sessionAccum, snap.sessionAccum),
        updatedAt: Math.max(existing.updatedAt, snap.updatedAt),
        updatedByDevice:
          existing.updatedAt >= snap.updatedAt ? existing.updatedByDevice : snap.updatedByDevice,
      };
      if (existing.maxCredits !== undefined || snap.maxCredits !== undefined) {
        merged.maxCredits = Math.max(existing.maxCredits ?? 0, snap.maxCredits ?? 0);
      }
      map.set(snap.date, merged);
    }
  }

  return Array.from(map.values()).sort((x, y) => x.date.localeCompare(y.date));
}

/**
 * Merge de SessionWindows.
 * Chave de deduplicação: (date, resetsAtMinute).
 * Em colisão, mantém peak máximo.
 * Comutativo, idempotente e associativo.
 */
export function mergeSessionWindows(
  a: SyncSessionWindow[],
  b: SyncSessionWindow[],
): SyncSessionWindow[] {
  const key = (w: SyncSessionWindow) => `${w.date}|${w.resetsAtMinute}`;
  const map = new Map<string, SyncSessionWindow>();

  for (const w of a) {
    map.set(key(w), { ...w });
  }

  for (const w of b) {
    const k = key(w);
    const existing = map.get(k);
    if (!existing) {
      map.set(k, { ...w });
    } else {
      map.set(k, {
        date: w.date,
        resetsAt: existing.updatedAt >= w.updatedAt ? existing.resetsAt : w.resetsAt,
        resetsAtMinute: w.resetsAtMinute,
        peak: Math.max(existing.peak, w.peak),
        updatedAt: Math.max(existing.updatedAt, w.updatedAt),
      });
    }
  }

  return Array.from(map.values()).sort((x, y) => {
    const d = x.date.localeCompare(y.date);
    return d !== 0 ? d : x.resetsAtMinute - y.resetsAtMinute;
  });
}

/**
 * Merge de CurrentSessionWindow.
 * Último resetsAt (por ISO string) vence.
 * Peak: max apenas quando mesma janela (resetsAt iguais); caso contrário só o peak da janela vencedora.
 * Isso evita que o peak de uma janela antiga contamine a janela corrente.
 */
export function mergeCurrentWindow(
  a: SyncCurrentWindow | undefined | null,
  b: SyncCurrentWindow | undefined | null,
): SyncCurrentWindow | undefined {
  if (!a && !b) return undefined;
  if (!a) return b ?? undefined;
  if (!b) return a;

  const aWins = a.resetsAt >= b.resetsAt;
  const sameWindow = a.resetsAt === b.resetsAt;
  return {
    resetsAt: aWins ? a.resetsAt : b.resetsAt,
    peak: sameWindow ? Math.max(a.peak, b.peak) : (aWins ? a.peak : b.peak),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

/**
 * Merge de TimeSeriesPoints (série temporal diária).
 * Append-only dedupado por ts.
 * Comutativo, idempotente e associativo.
 */
export function mergeTimeSeries(
  a: SyncTimeSeriesPoint[],
  b: SyncTimeSeriesPoint[],
): SyncTimeSeriesPoint[] {
  const map = new Map<number, SyncTimeSeriesPoint>();

  for (const p of a) {
    map.set(p.ts, { ...p });
  }
  for (const p of b) {
    if (!map.has(p.ts)) {
      map.set(p.ts, { ...p });
    }
  }

  return Array.from(map.values()).sort((x, y) => x.ts - y.ts);
}

/**
 * Merge de UsageSnapshots.
 * Append-only dedupado por ts.
 * Comutativo, idempotente e associativo.
 */
export function mergeUsageHistory(
  a: SyncUsageSnapshot[],
  b: SyncUsageSnapshot[],
): SyncUsageSnapshot[] {
  const map = new Map<number, SyncUsageSnapshot>();

  for (const s of a) {
    map.set(s.ts, { ...s });
  }
  for (const s of b) {
    if (!map.has(s.ts)) {
      map.set(s.ts, { ...s });
    }
  }

  return Array.from(map.values()).sort((x, y) => x.ts - y.ts);
}
