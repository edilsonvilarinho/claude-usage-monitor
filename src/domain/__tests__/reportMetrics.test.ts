import { describe, it, expect } from 'vitest';
import {
  computeSaturationRate,
  computeHeatmap,
  computeWeeklyTrend,
  computeExhaustionForecast,
  computeHourlyDistribution,
  computeNoSatStreak,
  computeRiskDays,
  computeExcessCost,
} from '../reportMetrics';
import type { SessionWindow, DailySnapshot } from '../entities/Usage';

const makeWindow = (peak: number, peakTs?: number): SessionWindow => ({
  resetsAt: '2026-04-21T12:00:00Z',
  peak,
  final: peak,
  date: '2026-04-21',
  peakTs,
});

const makeDay = (date: string, maxSession: number, maxWeekly = 0): DailySnapshot => ({
  date,
  maxSession,
  maxWeekly,
});

describe('computeSaturationRate', () => {
  it('retorna zeros para lista vazia', () => {
    expect(computeSaturationRate([])).toEqual({ saturated: 0, total: 0, pct: 0 });
  });

  it('retorna 100% quando todas as janelas saturaram', () => {
    const r = computeSaturationRate([makeWindow(100), makeWindow(120)]);
    expect(r).toEqual({ saturated: 2, total: 2, pct: 100 });
  });

  it('retorna 0% quando nenhuma janela saturou', () => {
    const r = computeSaturationRate([makeWindow(50), makeWindow(80)]);
    expect(r).toEqual({ saturated: 0, total: 2, pct: 0 });
  });

  it('conta exatamente 100% como saturada', () => {
    const r = computeSaturationRate([makeWindow(100)]);
    expect(r.saturated).toBe(1);
  });

  it('calcula percentual correto com mix', () => {
    const r = computeSaturationRate([makeWindow(100), makeWindow(50), makeWindow(120), makeWindow(80)]);
    expect(r).toEqual({ saturated: 2, total: 4, pct: 50 });
  });
});

describe('computeHeatmap', () => {
  it('retorna grid 7x3 zerado para lista vazia', () => {
    const h = computeHeatmap([]);
    expect(h).toHaveLength(7);
    h.forEach(row => expect(row).toEqual([0, 0, 0]));
  });

  it('ignora janelas sem peakTs', () => {
    const h = computeHeatmap([makeWindow(80)]);
    expect(h.flat().every(v => v === 0)).toBe(true);
  });

  it('incrementa período correto — manhã (hora 8)', () => {
    const ts = new Date('2026-04-21T08:00:00').getTime(); // terça = 2
    const h = computeHeatmap([makeWindow(80, ts)]);
    expect(h[2][0]).toBe(1);
  });

  it('incrementa período correto — tarde (hora 14)', () => {
    const ts = new Date('2026-04-21T14:00:00').getTime();
    const h = computeHeatmap([makeWindow(80, ts)]);
    expect(h[2][1]).toBe(1);
  });

  it('incrementa período correto — noite (hora 21)', () => {
    const ts = new Date('2026-04-21T21:00:00').getTime();
    const h = computeHeatmap([makeWindow(80, ts)]);
    expect(h[2][2]).toBe(1);
  });
});

describe('computeWeeklyTrend', () => {
  it('hasData=false para histórico < 7 dias', () => {
    const r = computeWeeklyTrend([makeDay('2026-04-21', 80)]);
    expect(r.hasData).toBe(false);
    expect(r.direction).toBe('flat');
  });

  it('hasData=false quando não há semana anterior (apenas 7 dias)', () => {
    const days = Array.from({ length: 7 }, (_, i) => makeDay(`2026-04-${String(15 + i).padStart(2,'0')}`, 50));
    const r = computeWeeklyTrend(days);
    expect(r.hasData).toBe(false);
  });

  it('detecta tendência de alta com médias corretas', () => {
    const prev = Array.from({ length: 7 }, (_, i) => makeDay(`2026-04-${String(1 + i).padStart(2,'0')}`, 40));
    const last = Array.from({ length: 7 }, (_, i) => makeDay(`2026-04-${String(8 + i).padStart(2,'0')}`, 80));
    const r = computeWeeklyTrend([...prev, ...last]);
    expect(r.direction).toBe('up');
    expect(r.delta).toBe(100);
    expect(r.avgLast).toBe(80);
    expect(r.avgPrev).toBe(40);
    expect(r.hasData).toBe(true);
  });

  it('detecta tendência de baixa com médias corretas', () => {
    const prev = Array.from({ length: 7 }, (_, i) => makeDay(`2026-04-${String(1 + i).padStart(2,'0')}`, 80));
    const last = Array.from({ length: 7 }, (_, i) => makeDay(`2026-04-${String(8 + i).padStart(2,'0')}`, 40));
    const r = computeWeeklyTrend([...prev, ...last]);
    expect(r.direction).toBe('down');
    expect(r.delta).toBe(50);
    expect(r.avgLast).toBe(40);
    expect(r.avgPrev).toBe(80);
    expect(r.hasData).toBe(true);
  });

  it('retorna flat quando delta <= 2%', () => {
    const prev = Array.from({ length: 7 }, (_, i) => makeDay(`2026-04-${String(1 + i).padStart(2,'0')}`, 100));
    const last = Array.from({ length: 7 }, (_, i) => makeDay(`2026-04-${String(8 + i).padStart(2,'0')}`, 101));
    const r = computeWeeklyTrend([...prev, ...last]);
    expect(r.direction).toBe('flat');
    expect(r.hasData).toBe(true);
  });
});

describe('computeExhaustionForecast', () => {
  it('hasData=false para histórico < 2 dias', () => {
    const r = computeExhaustionForecast([makeDay('2026-04-21', 50, 30)]);
    expect(r.hasData).toBe(false);
  });

  it('hasData=false quando não há deltas positivos', () => {
    const days = [
      makeDay('2026-04-20', 50, 50),
      makeDay('2026-04-21', 50, 50),
    ];
    const r = computeExhaustionForecast(days);
    expect(r.hasData).toBe(false);
  });

  it('detecta já saturado quando currentWeekly >= 100', () => {
    const days = [
      makeDay('2026-04-20', 80, 80),
      makeDay('2026-04-21', 90, 100),
    ];
    const r = computeExhaustionForecast(days);
    expect(r.alreadySaturated).toBe(true);
    expect(r.daysLeft).toBe(0);
  });

  it('calcula dias restantes corretamente', () => {
    const days = [
      makeDay('2026-04-18', 50, 10),
      makeDay('2026-04-19', 50, 20),
      makeDay('2026-04-20', 50, 30),
      makeDay('2026-04-21', 50, 40),
    ];
    const r = computeExhaustionForecast(days);
    expect(r.hasData).toBe(true);
    expect(r.avgDailyRate).toBe(10);
    expect(r.daysLeft).toBe(6); // remaining=60, rate=10 → ceil(60/10)=6
  });
});

describe('computeHourlyDistribution', () => {
  it('retorna array de 24 zeros para lista vazia', () => {
    const h = computeHourlyDistribution([]);
    expect(h).toHaveLength(24);
    expect(h.every(v => v === 0)).toBe(true);
  });

  it('ignora janelas sem peakTs', () => {
    const h = computeHourlyDistribution([makeWindow(80)]);
    expect(h.every(v => v === 0)).toBe(true);
  });

  it('incrementa bucket correto', () => {
    const ts = new Date('2026-04-21T15:00:00').getTime();
    const h = computeHourlyDistribution([makeWindow(80, ts)]);
    expect(h[15]).toBe(1);
    expect(h.filter(v => v > 0)).toHaveLength(1);
  });

  it('acumula múltiplas janelas na mesma hora', () => {
    const ts1 = new Date('2026-04-21T10:00:00').getTime();
    const ts2 = new Date('2026-04-22T10:30:00').getTime();
    const h = computeHourlyDistribution([makeWindow(80, ts1), makeWindow(90, ts2)]);
    expect(h[10]).toBe(2);
  });
});

describe('computeNoSatStreak', () => {
  it('retorna 0 para histórico vazio', () => {
    expect(computeNoSatStreak([])).toBe(0);
  });

  it('retorna 0 quando o último dia saturou', () => {
    const days = [
      makeDay('2026-04-20', 80),
      makeDay('2026-04-21', 100),
    ];
    expect(computeNoSatStreak(days)).toBe(0);
  });

  it('conta dias consecutivos sem saturação a partir do fim', () => {
    const days = [
      makeDay('2026-04-18', 100),
      makeDay('2026-04-19', 60),
      makeDay('2026-04-20', 70),
      makeDay('2026-04-21', 80),
    ];
    expect(computeNoSatStreak(days)).toBe(3);
  });

  it('streak é interrompido pelo primeiro dia saturado', () => {
    const days = [
      makeDay('2026-04-19', 50),
      makeDay('2026-04-20', 100),
      makeDay('2026-04-21', 50),
    ];
    expect(computeNoSatStreak(days)).toBe(1);
  });
});

describe('computeRiskDays', () => {
  it('retorna array vazio para lista sem peakTs', () => {
    const r = computeRiskDays([makeWindow(100)]);
    expect(r).toHaveLength(0);
  });

  it('ordena por pct de saturação decrescente', () => {
    // 2026-04-21 = terça (2), pico 09h
    const tue = new Date('2026-04-21T09:00:00').getTime();
    // 2026-04-20 = segunda (1), pico 14h
    const mon = new Date('2026-04-20T14:00:00').getTime();
    const windows = [
      makeWindow(120, tue),
      makeWindow(50, mon),
    ];
    const r = computeRiskDays(windows);
    expect(r[0].dayIndex).toBe(2); // terça: 100% de saturação
    expect(r[0].pct).toBe(100);
    expect(r[1].dayIndex).toBe(1); // segunda: 0%
    expect(r[1].pct).toBe(0);
  });
});

describe('computeExcessCost', () => {
  it('hasData=false para lista vazia', () => {
    const r = computeExcessCost([]);
    expect(r.hasData).toBe(false);
  });

  it('excessWindows=0 quando nenhuma janela excedeu 100', () => {
    const r = computeExcessCost([makeWindow(99), makeWindow(100)]);
    expect(r.excessWindows).toBe(0);
    expect(r.pct).toBe(0);
    expect(r.avgExcess).toBe(0);
  });

  it('calcula corretamente com janelas excessivas', () => {
    const r = computeExcessCost([makeWindow(120), makeWindow(150), makeWindow(80)]);
    expect(r.excessWindows).toBe(2);
    expect(r.totalWindows).toBe(3);
    expect(r.pct).toBe(67);
    expect(r.avgExcess).toBe(35); // (120-100)+(150-100) = 20+50 = 70 / 2 = 35
  });

  it('calcula avgExcess corretamente', () => {
    const r = computeExcessCost([makeWindow(110), makeWindow(130)]);
    // excesso: 10 + 30 = 40, avg = 20
    expect(r.avgExcess).toBe(20);
    expect(r.pct).toBe(100);
  });
});
