import { describe, it, expect } from 'vitest';
import { updateDailySnapshot } from '../dailySnapshotService';
import { DailySnapshot, UsageData } from '../../models/usageData';

function makeUsageData(sessionPct: number, weeklyPct: number, sessionResetsAt: string): UsageData {
  return {
    five_hour: { utilization: sessionPct, resets_at: sessionResetsAt },
    seven_day: { utilization: weeklyPct, resets_at: '2026-04-14T00:00:00Z' },
  };
}

const TODAY = '2026-04-07';
const RESET_A = '2026-04-07T10:00:00Z';
const RESET_B = '2026-04-07T15:00:00Z'; // +5h from A — qualifies as reset
const RESET_B_CLOSE = '2026-04-07T10:10:00Z'; // +10min from A — does NOT qualify

describe('updateDailySnapshot', () => {
  it('cria snapshot para primeira entrada do dia', () => {
    const history: DailySnapshot[] = [];
    const data = makeUsageData(30, 50, RESET_A);
    const result = updateDailySnapshot(history, TODAY, data, null);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date: TODAY,
      maxSession: 30,
      maxWeekly: 50,
      sessionResets: 1,
      sessionAccum: 0,
    });
  });

  it('atualização sem reset: maxSession cresce (max), sessionAccum não muda', () => {
    const history: DailySnapshot[] = [
      { date: TODAY, maxWeekly: 50, maxSession: 40, sessionResets: 1, sessionAccum: 0 },
    ];
    const prev = makeUsageData(40, 50, RESET_A);
    const curr = makeUsageData(60, 55, RESET_A); // mesmo resets_at → sem reset
    const result = updateDailySnapshot(history, TODAY, curr, prev);
    expect(result[0].maxSession).toBe(60);
    expect(result[0].maxWeekly).toBe(55);
    expect(result[0].sessionAccum).toBe(0);
    expect(result[0].sessionResets).toBe(1);
  });

  it('maxSession não decresce quando valor atual é menor', () => {
    const history: DailySnapshot[] = [
      { date: TODAY, maxWeekly: 50, maxSession: 80, sessionResets: 1, sessionAccum: 0 },
    ];
    const prev = makeUsageData(80, 50, RESET_A);
    const curr = makeUsageData(20, 50, RESET_A);
    const result = updateDailySnapshot(history, TODAY, curr, prev);
    expect(result[0].maxSession).toBe(80);
  });

  it('detecção de reset (resets_at avançou ≥ 30min): acumula pico anterior, incrementa sessionResets, reinicia maxSession', () => {
    const history: DailySnapshot[] = [
      { date: TODAY, maxWeekly: 50, maxSession: 70, sessionResets: 1, sessionAccum: 0 },
    ];
    const prev = makeUsageData(70, 50, RESET_A);
    const curr = makeUsageData(14, 52, RESET_B); // resets_at avançou 5h
    const result = updateDailySnapshot(history, TODAY, curr, prev);
    expect(result[0].sessionAccum).toBe(70);
    expect(result[0].sessionResets).toBe(2);
    expect(result[0].maxSession).toBe(14);
  });

  it('não-reset (resets_at avançou < 30min): não acumula, trata como normal', () => {
    const history: DailySnapshot[] = [
      { date: TODAY, maxWeekly: 50, maxSession: 70, sessionResets: 1, sessionAccum: 0 },
    ];
    const prev = makeUsageData(70, 50, RESET_A);
    const curr = makeUsageData(75, 52, RESET_B_CLOSE); // só +10min — não é reset
    const result = updateDailySnapshot(history, TODAY, curr, prev);
    expect(result[0].sessionAccum).toBe(0);
    expect(result[0].sessionResets).toBe(1);
    expect(result[0].maxSession).toBe(75);
  });

  it('múltiplos resets no dia: acumulação correta após dois resets', () => {
    const history: DailySnapshot[] = [
      { date: TODAY, maxWeekly: 50, maxSession: 70, sessionResets: 1, sessionAccum: 0 },
    ];
    // Primeiro reset
    const prev1 = makeUsageData(70, 50, RESET_A);
    const curr1 = makeUsageData(14, 52, RESET_B);
    updateDailySnapshot(history, TODAY, curr1, prev1);
    expect(history[0].sessionAccum).toBe(70);
    expect(history[0].sessionResets).toBe(2);
    expect(history[0].maxSession).toBe(14);

    // Cresce na segunda janela
    const prev2 = makeUsageData(14, 52, RESET_B);
    const curr2a = makeUsageData(50, 53, RESET_B);
    updateDailySnapshot(history, TODAY, curr2a, prev2);
    expect(history[0].maxSession).toBe(50);

    // Segundo reset
    const RESET_C = '2026-04-07T20:00:00Z';
    const prev3 = makeUsageData(50, 53, RESET_B);
    const curr3 = makeUsageData(5, 54, RESET_C);
    updateDailySnapshot(history, TODAY, curr3, prev3);
    expect(history[0].sessionAccum).toBe(120); // 70 + 50
    expect(history[0].sessionResets).toBe(3);
    expect(history[0].maxSession).toBe(5);
  });

  it('limite de 8 entradas: histórico é truncado a 8 dias', () => {
    const history: DailySnapshot[] = Array.from({ length: 8 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, '0')}`,
      maxWeekly: 10,
      maxSession: 10,
      sessionResets: 1,
      sessionAccum: 0,
    }));
    const data = makeUsageData(20, 20, RESET_A);
    const result = updateDailySnapshot(history, TODAY, data, null);
    expect(result).toHaveLength(8);
    // A entrada mais recente deve estar presente
    expect(result[result.length - 1].date).toBe(TODAY);
    // A mais antiga deve ter sido removida
    expect(result.find(d => d.date === '2026-03-01')).toBeUndefined();
  });

  it('maxWeekly só cresce: Math.max(existingDay.maxWeekly, novo)', () => {
    const history: DailySnapshot[] = [
      { date: TODAY, maxWeekly: 70, maxSession: 30, sessionResets: 1, sessionAccum: 0 },
    ];
    const prev = makeUsageData(30, 70, RESET_A);
    const curr = makeUsageData(35, 40, RESET_A); // weeklyPct caiu para 40
    const result = updateDailySnapshot(history, TODAY, curr, prev);
    expect(result[0].maxWeekly).toBe(70);
  });
});
