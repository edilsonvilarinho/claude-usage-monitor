import { describe, it, expect } from 'vitest';
import {
  mergeDailySnapshots,
  mergeSessionWindows,
  mergeCurrentWindow,
  mergeTimeSeries,
  mergeUsageHistory,
  toMinuteTs,
} from './merge';
import type {
  SyncDailySnapshot,
  SyncSessionWindow,
  SyncCurrentWindow,
  SyncTimeSeriesPoint,
  SyncUsageSnapshot,
} from './syncTypes';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const daily1: SyncDailySnapshot = {
  date: '2024-01-01',
  maxWeekly: 50,
  maxSession: 60,
  sessionWindowCount: 1,
  sessionAccum: 30,
  updatedAt: 1000,
  updatedByDevice: 'dev-a',
};

const daily2: SyncDailySnapshot = {
  date: '2024-01-01',
  maxWeekly: 70,
  maxSession: 40,
  sessionWindowCount: 2,
  sessionAccum: 50,
  updatedAt: 2000,
  updatedByDevice: 'dev-b',
};

const daily3: SyncDailySnapshot = {
  date: '2024-01-02',
  maxWeekly: 80,
  maxSession: 90,
  sessionWindowCount: 1,
  sessionAccum: 0,
  updatedAt: 1500,
  updatedByDevice: 'dev-a',
};

const win1: SyncSessionWindow = {
  date: '2024-01-01',
  resetsAt: '2024-01-01T05:00:00.000Z',
  resetsAtMinute: toMinuteTs(new Date('2024-01-01T05:00:00.000Z').getTime()) / 60000,
  peak: 60,
  updatedAt: 1000,
};

const win2: SyncSessionWindow = {
  ...win1,
  peak: 80,
  updatedAt: 2000,
};

const win3: SyncSessionWindow = {
  date: '2024-01-01',
  resetsAt: '2024-01-01T10:00:00.000Z',
  resetsAtMinute: toMinuteTs(new Date('2024-01-01T10:00:00.000Z').getTime()) / 60000,
  peak: 55,
  updatedAt: 3000,
};

const ts1: SyncTimeSeriesPoint = { ts: 1000, date: '2024-01-01', session: 50, weekly: 30 };
const ts2: SyncTimeSeriesPoint = { ts: 2000, date: '2024-01-01', session: 60, weekly: 40 };
const ts3: SyncTimeSeriesPoint = { ts: 3000, date: '2024-01-01', session: 70, weekly: 50 };

const snap1: SyncUsageSnapshot = { ts: 1000, session: 50, weekly: 30 };
const snap2: SyncUsageSnapshot = { ts: 2000, session: 60, weekly: 40 };
const snap3: SyncUsageSnapshot = { ts: 3000, session: 70, weekly: 50 };

const curWin1: SyncCurrentWindow = { resetsAt: '2024-01-01T05:00:00.000Z', peak: 60, updatedAt: 1000 };
const curWin2: SyncCurrentWindow = { resetsAt: '2024-01-01T10:00:00.000Z', peak: 40, updatedAt: 2000 };

// ─── toMinuteTs ──────────────────────────────────────────────────────────────

describe('toMinuteTs', () => {
  it('trunca para o minuto mais próximo', () => {
    expect(toMinuteTs(61000)).toBe(60000);
    expect(toMinuteTs(60000)).toBe(60000);
    expect(toMinuteTs(59999)).toBe(0);
    expect(toMinuteTs(120000)).toBe(120000);
  });
});

// ─── mergeDailySnapshots ─────────────────────────────────────────────────────

describe('mergeDailySnapshots', () => {
  it('pega max() de cada campo numérico', () => {
    const result = mergeDailySnapshots([daily1], [daily2]);
    expect(result).toHaveLength(1);
    const r = result[0];
    expect(r.maxWeekly).toBe(70);
    expect(r.maxSession).toBe(60);
    expect(r.sessionWindowCount).toBe(2);
    expect(r.sessionAccum).toBe(50);
    expect(r.updatedByDevice).toBe('dev-b'); // updatedAt maior
  });

  it('comutativo: merge(a,b) === merge(b,a)', () => {
    const ab = mergeDailySnapshots([daily1, daily3], [daily2]);
    const ba = mergeDailySnapshots([daily2], [daily1, daily3]);
    expect(ab).toEqual(ba);
  });

  it('idempotente: merge(a,a) === a', () => {
    const a = [daily1, daily3];
    const result = mergeDailySnapshots(a, a);
    expect(result).toEqual(mergeDailySnapshots(a, []));
  });

  it('associativo: merge(merge(a,b),c) === merge(a,merge(b,c))', () => {
    const a = [daily1];
    const b = [daily2];
    const c = [daily3];
    const left = mergeDailySnapshots(mergeDailySnapshots(a, b), c);
    const right = mergeDailySnapshots(a, mergeDailySnapshots(b, c));
    expect(left).toEqual(right);
  });

  it('preserva maxCredits quando presente em qualquer lado', () => {
    const withCredits = { ...daily1, maxCredits: 30 };
    const result = mergeDailySnapshots([withCredits], [daily2]);
    expect(result[0].maxCredits).toBe(30);
  });

  it('pega max de maxCredits', () => {
    const a = { ...daily1, maxCredits: 30 };
    const b = { ...daily2, maxCredits: 50 };
    const result = mergeDailySnapshots([a], [b]);
    expect(result[0].maxCredits).toBe(50);
  });

  it('combina datas diferentes', () => {
    const result = mergeDailySnapshots([daily1], [daily3]);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2024-01-01');
    expect(result[1].date).toBe('2024-01-02');
  });
});

// ─── mergeSessionWindows ─────────────────────────────────────────────────────

describe('mergeSessionWindows', () => {
  it('mantém peak máximo em colisão', () => {
    const result = mergeSessionWindows([win1], [win2]);
    expect(result).toHaveLength(1);
    expect(result[0].peak).toBe(80);
  });

  it('comutativo: merge(a,b) === merge(b,a)', () => {
    const ab = mergeSessionWindows([win1, win3], [win2]);
    const ba = mergeSessionWindows([win2], [win1, win3]);
    expect(ab).toEqual(ba);
  });

  it('idempotente: merge(a,a) === a', () => {
    const a = [win1, win3];
    expect(mergeSessionWindows(a, a)).toEqual(mergeSessionWindows(a, []));
  });

  it('associativo: merge(merge(a,b),c) === merge(a,merge(b,c))', () => {
    const a = [win1];
    const b = [win2];
    const c = [win3];
    const left = mergeSessionWindows(mergeSessionWindows(a, b), c);
    const right = mergeSessionWindows(a, mergeSessionWindows(b, c));
    expect(left).toEqual(right);
  });

  it('chaves diferentes não se fundem', () => {
    const result = mergeSessionWindows([win1], [win3]);
    expect(result).toHaveLength(2);
  });
});

// ─── mergeCurrentWindow ──────────────────────────────────────────────────────

describe('mergeCurrentWindow', () => {
  it('último resetsAt vence', () => {
    const result = mergeCurrentWindow(curWin1, curWin2);
    expect(result?.resetsAt).toBe(curWin2.resetsAt);
  });

  it('janelas diferentes: peak da janela mais nova vence (não contamina)', () => {
    // a é janela ANTIGA com peak alto; b é janela NOVA com peak menor
    const a: SyncCurrentWindow = { ...curWin1, peak: 90 };
    const b: SyncCurrentWindow = { ...curWin2, peak: 40 };
    const result = mergeCurrentWindow(a, b);
    // peak deve ser 40 (da janela nova), não 90 da janela antiga
    expect(result?.peak).toBe(40);
  });

  it('mesma janela: peak = max dos dois', () => {
    const a: SyncCurrentWindow = { ...curWin1, peak: 90 };
    const b: SyncCurrentWindow = { ...curWin1, peak: 40 };
    const result = mergeCurrentWindow(a, b);
    expect(result?.peak).toBe(90);
  });

  it('comutativo', () => {
    expect(mergeCurrentWindow(curWin1, curWin2)).toEqual(mergeCurrentWindow(curWin2, curWin1));
  });

  it('idempotente', () => {
    expect(mergeCurrentWindow(curWin1, curWin1)).toEqual(mergeCurrentWindow(curWin1, undefined));
  });

  it('retorna undefined quando ambos são nulos', () => {
    expect(mergeCurrentWindow(null, null)).toBeUndefined();
    expect(mergeCurrentWindow(undefined, undefined)).toBeUndefined();
  });

  it('retorna o existente quando um é nulo', () => {
    expect(mergeCurrentWindow(curWin1, null)?.resetsAt).toBe(curWin1.resetsAt);
    expect(mergeCurrentWindow(null, curWin2)?.resetsAt).toBe(curWin2.resetsAt);
  });
});

// ─── mergeTimeSeries ─────────────────────────────────────────────────────────

describe('mergeTimeSeries', () => {
  it('dedupa por ts', () => {
    const result = mergeTimeSeries([ts1, ts2], [ts2, ts3]);
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.ts)).toEqual([1000, 2000, 3000]);
  });

  it('comutativo', () => {
    const ab = mergeTimeSeries([ts1, ts2], [ts3]);
    const ba = mergeTimeSeries([ts3], [ts1, ts2]);
    expect(ab).toEqual(ba);
  });

  it('idempotente', () => {
    const a = [ts1, ts2];
    expect(mergeTimeSeries(a, a)).toEqual(mergeTimeSeries(a, []));
  });

  it('associativo', () => {
    const left = mergeTimeSeries(mergeTimeSeries([ts1], [ts2]), [ts3]);
    const right = mergeTimeSeries([ts1], mergeTimeSeries([ts2], [ts3]));
    expect(left).toEqual(right);
  });
});

// ─── mergeUsageHistory ───────────────────────────────────────────────────────

describe('mergeUsageHistory', () => {
  it('dedupa por ts', () => {
    const result = mergeUsageHistory([snap1, snap2], [snap2, snap3]);
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.ts)).toEqual([1000, 2000, 3000]);
  });

  it('comutativo', () => {
    const ab = mergeUsageHistory([snap1, snap2], [snap3]);
    const ba = mergeUsageHistory([snap3], [snap1, snap2]);
    expect(ab).toEqual(ba);
  });

  it('idempotente', () => {
    const a = [snap1, snap2];
    expect(mergeUsageHistory(a, a)).toEqual(mergeUsageHistory(a, []));
  });

  it('associativo', () => {
    const left = mergeUsageHistory(mergeUsageHistory([snap1], [snap2]), [snap3]);
    const right = mergeUsageHistory([snap1], mergeUsageHistory([snap2], [snap3]));
    expect(left).toEqual(right);
  });
});
