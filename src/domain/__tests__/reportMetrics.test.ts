import { describe, it, expect } from 'vitest';
import {
  computeSaturationRate,
  computeHeatmap,
  computeWeeklyTrend,
} from '../reportMetrics';
import type { SessionWindow, DailySnapshot } from '../entities/Usage';

const makeWindow = (peak: number, peakTs?: number): SessionWindow => ({
  resetsAt: '2026-04-21T12:00:00Z',
  peak,
  final: peak,
  date: '2026-04-21',
  peakTs,
});

const makeDay = (date: string, maxSession: number): DailySnapshot => ({
  date,
  maxSession,
  maxWeekly: 0,
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
