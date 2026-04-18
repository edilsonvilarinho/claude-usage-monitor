import { DailySnapshot, UsageData, CurrentSessionWindow, SessionWindowRecord } from '../models/usageData';

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

export interface UpdateSnapshotResult {
  dailyHistory: DailySnapshot[];
  /** Estado atualizado da janela corrente — deve ser persistido pelo caller */
  currentWindow: CurrentSessionWindow;
  /** Janela completada neste poll (não-null se houve reset) — deve ser salva em sessionWindows */
  completedWindow: SessionWindowRecord | null;
}

/**
 * Atualiza o histórico diário com os dados do poll atual.
 *
 * Detecção de reset: compara currentWindow.resetsAt (persistido) com data.five_hour.resets_at
 * da API. Isso funciona mesmo após restart do app (prevData = null não é mais necessário).
 *
 * Acumulação: usa currentWindow.peak (maior valor observado na janela) em vez do último
 * valor polled — garante que o sessionAccum reflita o pico real de cada janela.
 */
export function updateDailySnapshot(
  dailyHistory: DailySnapshot[],
  today: string,
  data: UsageData,
  currentWindow: CurrentSessionWindow | null,
  now: number = Date.now(),
): UpdateSnapshotResult {
  const weeklyPctInt  = Math.round(data.seven_day.utilization);
  const sessionPctInt = Math.round(data.five_hour.utilization);
  const extra = data.extra_usage;
  const creditsPctInt = (extra?.is_enabled && extra.monthly_limit > 0)
    ? Math.round((extra.used_credits / extra.monthly_limit) * 100)
    : undefined;

  const newResetsAt    = data.five_hour.resets_at;
  const newResetsAtMs  = new Date(newResetsAt).getTime();

  // ── Detectar reset ──────────────────────────────────────────────────────────
  let sessionResetOccurred = false;
  if (currentWindow) {
    const storedResetsAtMs = new Date(currentWindow.resetsAt).getTime();
    if (newResetsAtMs - storedResetsAtMs >= THIRTY_MINUTES_MS) {
      sessionResetOccurred = true;
    }
  }

  // ── Atualizar DailySnapshot ─────────────────────────────────────────────────
  let completedWindow: SessionWindowRecord | null = null;
  const existingDay = dailyHistory.find(d => d.date === today);

  if (existingDay) {
    if (sessionResetOccurred && currentWindow) {
      const peak = currentWindow.peak;
      const final = currentWindow.final;
      const windowDate = currentWindow.date;
      if (windowDate && windowDate < today && dailyHistory.length > 0) {
        const prevDay = dailyHistory.find(d => d.date === windowDate)
          ?? dailyHistory[dailyHistory.length - 1];
        completedWindow = { resetsAt: currentWindow.resetsAt, peak, final, date: prevDay.date, peakTs: currentWindow.peakTs };
        prevDay.sessionAccum = (prevDay.sessionAccum ?? 0) + peak;
      } else {
        completedWindow = { resetsAt: currentWindow.resetsAt, peak, final, date: today, peakTs: currentWindow.peakTs };
        existingDay.sessionAccum  = (existingDay.sessionAccum  ?? 0) + peak;
        existingDay.sessionWindowCount = (existingDay.sessionWindowCount ?? 1) + 1;
      }
      existingDay.maxSession    = sessionPctInt;
    } else {
      existingDay.maxSession = Math.max(existingDay.maxSession ?? 0, sessionPctInt);
    }
    existingDay.maxWeekly = Math.max(existingDay.maxWeekly, weeklyPctInt);
    if (creditsPctInt !== undefined) {
      existingDay.maxCredits = Math.max(existingDay.maxCredits ?? 0, creditsPctInt);
    }
  } else {
    // Novo dia: se houve reset na fronteira do dia, acumula o pico no dia anterior
    if (sessionResetOccurred && currentWindow && dailyHistory.length > 0) {
      const prevDay = dailyHistory[dailyHistory.length - 1];
      const peak = currentWindow.peak;
      const final = currentWindow.final;
      completedWindow = { resetsAt: currentWindow.resetsAt, peak, final, date: prevDay.date, peakTs: currentWindow.peakTs };
      prevDay.sessionAccum = (prevDay.sessionAccum ?? 0) + peak;
    }
    dailyHistory.push({
      date: today,
      maxWeekly: weeklyPctInt,
      maxSession: sessionPctInt,
      maxCredits: creditsPctInt,
      sessionWindowCount: 1,
      sessionAccum: 0,
    });
  }

  dailyHistory.sort((a, b) => a.date.localeCompare(b.date));
  if (dailyHistory.length > 8) dailyHistory.splice(0, dailyHistory.length - 8);

  // ── Atualizar currentWindow ─────────────────────────────────────────────────
  const newCurrentWindow: CurrentSessionWindow = sessionResetOccurred
    ? { resetsAt: newResetsAt, peak: 0, final: 0, date: today, peakTs: undefined }
    : !currentWindow
      ? { resetsAt: newResetsAt, peak: sessionPctInt, final: sessionPctInt, date: today, peakTs: now }
      : { resetsAt: currentWindow.resetsAt, peak: Math.max(currentWindow.peak, sessionPctInt), final: sessionPctInt, date: currentWindow.date ?? today, peakTs: sessionPctInt > currentWindow.peak ? now : currentWindow.peakTs };

  return { dailyHistory, currentWindow: newCurrentWindow, completedWindow };
}
