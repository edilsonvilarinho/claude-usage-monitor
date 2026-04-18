import { describe, it, expect } from 'vitest';
import { updateDailySnapshot } from '../dailySnapshotService';
import { CurrentSessionWindow, DailySnapshot, UsageData } from '../../models/usageData';

function makeUsageData(sessionPct: number, weeklyPct: number, sessionResetsAt: string): UsageData {
  return {
    five_hour: { utilization: sessionPct, resets_at: sessionResetsAt },
    seven_day: { utilization: weeklyPct, resets_at: '2026-04-14T00:00:00Z' },
  };
}

function makeWindow(resetsAt: string, peak: number, final?: number): CurrentSessionWindow {
  return { resetsAt, peak, final: final ?? peak };
}

const TODAY  = '2026-04-07';
const RESET_A = '2026-04-07T10:00:00Z';
const RESET_B = '2026-04-07T15:00:00Z'; // +5h — qualifica como reset
const RESET_C = '2026-04-07T20:00:00Z'; // +5h — segundo reset
const RESET_CLOSE = '2026-04-07T10:10:00Z'; // +10min — NÃO qualifica

describe('updateDailySnapshot', () => {

  // ── Inicialização ────────────────────────────────────────────────────────────

  it('cria snapshot e currentWindow quando não há histórico (primeiro run)', () => {
    const { dailyHistory, currentWindow, completedWindow } =
      updateDailySnapshot([], TODAY, makeUsageData(30, 50, RESET_A), null);

    expect(dailyHistory).toHaveLength(1);
    expect(dailyHistory[0]).toMatchObject({ date: TODAY, maxSession: 30, maxWeekly: 50, sessionWindowCount: 1, sessionAccum: 0 });
    expect(currentWindow).toMatchObject({ resetsAt: RESET_A, peak: 30, date: TODAY });
    expect(currentWindow.peakTs).toBeDefined();
    expect(completedWindow).toBeNull();
  });

  it('cria currentWindow mesmo sem histórico prévio (null)', () => {
    const { currentWindow } =
      updateDailySnapshot([], TODAY, makeUsageData(45, 60, RESET_A), null);
    expect(currentWindow.resetsAt).toBe(RESET_A);
    expect(currentWindow.peak).toBe(45);
  });

  // ── Progressão sem reset ─────────────────────────────────────────────────────

  it('sem reset: maxSession cresce (max), sessionAccum inalterado', () => {
    const history: DailySnapshot[] = [
      { date: TODAY, maxWeekly: 50, maxSession: 40, sessionWindowCount: 1, sessionAccum: 0 },
    ];
    const window = makeWindow(RESET_A, 40);
    const { dailyHistory, currentWindow, completedWindow } =
      updateDailySnapshot(history, TODAY, makeUsageData(60, 55, RESET_A), window);

    expect(dailyHistory[0].maxSession).toBe(60);
    expect(dailyHistory[0].maxWeekly).toBe(55);
    expect(dailyHistory[0].sessionAccum).toBe(0);
    expect(dailyHistory[0].sessionWindowCount).toBe(1);
    expect(currentWindow.peak).toBe(60); // pico atualizado
    expect(currentWindow.resetsAt).toBe(RESET_A);
    expect(completedWindow).toBeNull();
  });

  it('sem reset: peak do currentWindow acumula via Math.max', () => {
    const window = makeWindow(RESET_A, 80); // pico anterior era 80
    const { currentWindow } =
      updateDailySnapshot([], TODAY, makeUsageData(20, 50, RESET_A), window);
    expect(currentWindow.peak).toBe(80); // não regride
  });

  it('maxSession não decresce quando valor atual é menor', () => {
    const history: DailySnapshot[] = [
      { date: TODAY, maxWeekly: 50, maxSession: 80, sessionWindowCount: 1, sessionAccum: 0 },
    ];
    const { dailyHistory } =
      updateDailySnapshot(history, TODAY, makeUsageData(20, 50, RESET_A), makeWindow(RESET_A, 80));
    expect(dailyHistory[0].maxSession).toBe(80);
  });

  it('maxWeekly só cresce: Math.max(existing, novo)', () => {
    const history: DailySnapshot[] = [
      { date: TODAY, maxWeekly: 70, maxSession: 30, sessionWindowCount: 1, sessionAccum: 0 },
    ];
    const { dailyHistory } =
      updateDailySnapshot(history, TODAY, makeUsageData(35, 40, RESET_A), makeWindow(RESET_A, 30));
    expect(dailyHistory[0].maxWeekly).toBe(70);
  });

  // ── Detecção de reset ────────────────────────────────────────────────────────

  it('reset detectado (resets_at avançou ≥ 30min): usa peak da janela completada', () => {
    const history: DailySnapshot[] = [
      { date: TODAY, maxWeekly: 50, maxSession: 70, sessionWindowCount: 1, sessionAccum: 0 },
    ];
    // currentWindow.peak = 70; nova janela inicia sempre com peak: 0 (sem herança residual)
    const window = makeWindow(RESET_A, 70);
    const { dailyHistory, currentWindow, completedWindow } =
      updateDailySnapshot(history, TODAY, makeUsageData(14, 52, RESET_B), window);

    expect(dailyHistory[0].sessionAccum).toBe(70);  // usa peak, não último valor polled
    expect(dailyHistory[0].sessionWindowCount).toBe(2);
    expect(dailyHistory[0].maxSession).toBe(14);    // reinicia com valor da nova janela
    expect(currentWindow).toEqual({ resetsAt: RESET_B, peak: 0, final: 0, date: TODAY, peakTs: undefined });
    expect(completedWindow).toMatchObject({ resetsAt: RESET_A, peak: 70, final: 70, date: TODAY });
  });

  it('FIX: acumulado usa pico rastreado, não o último valor polled antes do reset', () => {
    // Cenário: janela atingiu 95% em algum momento mas o poll antes do reset capturou 60%
    // Lógica antiga acumularia 60; nova acumula 95 (o pico real)
    const history: DailySnapshot[] = [
      { date: TODAY, maxWeekly: 50, maxSession: 95, sessionWindowCount: 1, sessionAccum: 0 },
    ];
    const window = makeWindow(RESET_A, 95); // pico rastreado = 95
    const { dailyHistory } =
      updateDailySnapshot(history, TODAY, makeUsageData(10, 52, RESET_B), window);

    expect(dailyHistory[0].sessionAccum).toBe(95); // pico correto, não 10 (valor ao resetar)
  });

  it('FIX: reset detectado mesmo após restart (currentWindow persistido, sem prevData)', () => {
    // Simula: app reiniciou, prevData = null, mas currentWindow foi restaurado do disco
    const history: DailySnapshot[] = [
      { date: TODAY, maxWeekly: 50, maxSession: 80, sessionWindowCount: 1, sessionAccum: 0 },
    ];
    // currentWindow armazenado tem o resetsAt antigo (RESET_A)
    const storedWindow = makeWindow(RESET_A, 80);
    // API retorna novo resetsAt (RESET_B) — significa que resetou enquanto app estava fechado
    const { dailyHistory, completedWindow } =
      updateDailySnapshot(history, TODAY, makeUsageData(5, 52, RESET_B), storedWindow);

    expect(dailyHistory[0].sessionAccum).toBe(80); // reset detectado corretamente
    expect(dailyHistory[0].sessionWindowCount).toBe(2);
    expect(completedWindow).not.toBeNull();
  });

  it('não-reset (resets_at avançou < 30min): não acumula, trata como update normal', () => {
    const history: DailySnapshot[] = [
      { date: TODAY, maxWeekly: 50, maxSession: 70, sessionWindowCount: 1, sessionAccum: 0 },
    ];
    const { dailyHistory, completedWindow } =
      updateDailySnapshot(history, TODAY, makeUsageData(75, 52, RESET_CLOSE), makeWindow(RESET_A, 70));

    expect(dailyHistory[0].sessionAccum).toBe(0);
    expect(dailyHistory[0].sessionWindowCount).toBe(1);
    expect(dailyHistory[0].maxSession).toBe(75);
    expect(completedWindow).toBeNull();
  });

  // ── Múltiplos resets ─────────────────────────────────────────────────────────

  it('múltiplos resets: acumulação correta após dois resets com picos diferentes', () => {
    const history: DailySnapshot[] = [
      { date: TODAY, maxWeekly: 50, maxSession: 70, sessionWindowCount: 1, sessionAccum: 0 },
    ];

    // Primeiro reset — pico da janela 1 = 70
    const r1 = updateDailySnapshot(history, TODAY, makeUsageData(14, 52, RESET_B), makeWindow(RESET_A, 70));
    expect(r1.dailyHistory[0].sessionAccum).toBe(70);
    expect(r1.dailyHistory[0].sessionWindowCount).toBe(2);
    expect(r1.dailyHistory[0].maxSession).toBe(14);

    // Janela 2 cresce até 50
    const r2 = updateDailySnapshot(r1.dailyHistory, TODAY, makeUsageData(50, 53, RESET_B), makeWindow(RESET_B, 50));
    expect(r2.dailyHistory[0].maxSession).toBe(50);
    expect(r2.currentWindow.peak).toBe(50);

    // Segundo reset — pico da janela 2 = 50
    const r3 = updateDailySnapshot(r2.dailyHistory, TODAY, makeUsageData(5, 54, RESET_C), makeWindow(RESET_B, 50));
    expect(r3.dailyHistory[0].sessionAccum).toBe(120); // 70 + 50
    expect(r3.dailyHistory[0].sessionWindowCount).toBe(3);
    expect(r3.dailyHistory[0].maxSession).toBe(5);
    expect(r3.completedWindow).toMatchObject({ resetsAt: RESET_B, peak: 50 });
  });

  // ── Limite de dias ───────────────────────────────────────────────────────────

  it('limite de 8 entradas: histórico é truncado', () => {
    const history: DailySnapshot[] = Array.from({ length: 8 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, '0')}`,
      maxWeekly: 10, maxSession: 10, sessionWindowCount: 1, sessionAccum: 0,
    }));
    const { dailyHistory } = updateDailySnapshot(history, TODAY, makeUsageData(20, 20, RESET_A), null);
    expect(dailyHistory).toHaveLength(8);
    expect(dailyHistory[dailyHistory.length - 1].date).toBe(TODAY);
    expect(dailyHistory.find(d => d.date === '2026-03-01')).toBeUndefined();
  });

  // ── peakTs ───────────────────────────────────────────────────────────────────

  it('peakTs: definido na primeira janela (primeiro poll)', () => {
    const FAKE_NOW = 1_700_000_000_000;
    const { currentWindow } = updateDailySnapshot([], TODAY, makeUsageData(30, 50, RESET_A), null, FAKE_NOW);
    expect(currentWindow.peakTs).toBe(FAKE_NOW);
  });

  it('peakTs: atualizado quando há novo pico', () => {
    const FAKE_NOW1 = 1_700_000_000_000;
    const FAKE_NOW2 = 1_700_000_001_000;
    const { currentWindow: w1 } = updateDailySnapshot([], TODAY, makeUsageData(30, 50, RESET_A), null, FAKE_NOW1);
    expect(w1.peakTs).toBe(FAKE_NOW1);
    const history = [{ date: TODAY, maxWeekly: 50, maxSession: 30, sessionWindowCount: 1, sessionAccum: 0 }];
    const { currentWindow: w2 } = updateDailySnapshot(history, TODAY, makeUsageData(60, 50, RESET_A), w1, FAKE_NOW2);
    expect(w2.peakTs).toBe(FAKE_NOW2);
  });

  it('peakTs: NÃO muda quando novo valor é menor que o pico', () => {
    const FAKE_NOW1 = 1_700_000_000_000;
    const FAKE_NOW2 = 1_700_000_001_000;
    const window80 = makeWindow(RESET_A, 80);
    (window80 as CurrentSessionWindow & { peakTs: number }).peakTs = FAKE_NOW1;
    const history = [{ date: TODAY, maxWeekly: 50, maxSession: 80, sessionWindowCount: 1, sessionAccum: 0 }];
    const { currentWindow } = updateDailySnapshot(history, TODAY, makeUsageData(20, 50, RESET_A), window80, FAKE_NOW2);
    expect(currentWindow.peakTs).toBe(FAKE_NOW1);
  });

  it('peakTs: propagado para completedWindow ao resetar', () => {
    const FAKE_NOW = 1_700_000_000_000;
    const window70 = makeWindow(RESET_A, 70);
    (window70 as CurrentSessionWindow & { peakTs: number }).peakTs = FAKE_NOW;
    const history = [{ date: TODAY, maxWeekly: 50, maxSession: 70, sessionWindowCount: 1, sessionAccum: 0 }];
    const { completedWindow } = updateDailySnapshot(history, TODAY, makeUsageData(14, 52, RESET_B), window70);
    expect(completedWindow?.peakTs).toBe(FAKE_NOW);
  });

  it('peakTs: undefined após reset (nova janela sem pico ainda)', () => {
    const FAKE_NOW = 1_700_000_000_000;
    const window70 = makeWindow(RESET_A, 70);
    (window70 as CurrentSessionWindow & { peakTs: number }).peakTs = FAKE_NOW;
    const history = [{ date: TODAY, maxWeekly: 50, maxSession: 70, sessionWindowCount: 1, sessionAccum: 0 }];
    const { currentWindow } = updateDailySnapshot(history, TODAY, makeUsageData(14, 52, RESET_B), window70);
    expect(currentWindow.peakTs).toBeUndefined();
  });

  // ── Credits ─────────────────────────────────────────────────────────────────

  it('maxCredits cresce com creditsPctInt definido', () => {
    const usageWithCredits = {
      five_hour: { utilization: 30, resets_at: RESET_A },
      seven_day: { utilization: 50, resets_at: '2026-04-14T00:00:00Z' },
      extra_usage: { is_enabled: true, used_credits: 75, monthly_limit: 100 },
    } as unknown as UsageData;
    const { dailyHistory } = updateDailySnapshot([], TODAY, usageWithCredits, null);
    expect(dailyHistory[0].maxCredits).toBe(75);
  });

  it('maxCredits não decresce', () => {
    const history: DailySnapshot[] = [
      { date: TODAY, maxWeekly: 50, maxSession: 30, sessionWindowCount: 1, sessionAccum: 0, maxCredits: 80 },
    ];
    const usageWithCredits = {
      five_hour: { utilization: 30, resets_at: RESET_A },
      seven_day: { utilization: 50, resets_at: '2026-04-14T00:00:00Z' },
      extra_usage: { is_enabled: true, used_credits: 40, monthly_limit: 100 },
    } as unknown as UsageData;
    const { dailyHistory } = updateDailySnapshot(history, TODAY, usageWithCredits, makeWindow(RESET_A, 30));
    expect(dailyHistory[0].maxCredits).toBe(80);
  });

  // ── Edge cases ───────────────────────────────────────────────────────────────

  it('reset na fronteira do dia: acumula pico no dia anterior', () => {
    const YESTERDAY = '2026-04-06';
    const history: DailySnapshot[] = [
      { date: YESTERDAY, maxWeekly: 50, maxSession: 90, sessionWindowCount: 1, sessionAccum: 0 },
    ];
    const storedWindow = makeWindow(RESET_A, 90); // janela de ontem
    // API retorna novo reset HOJE (crosses midnight)
    const { dailyHistory, completedWindow } = updateDailySnapshot(history, TODAY, makeUsageData(5, 52, RESET_B), storedWindow);
    expect(dailyHistory[0].sessionAccum).toBe(90);
    expect(completedWindow?.date).toBe(YESTERDAY);
  });
});
