import type { WorkSchedule } from './settingsService';

export type SmartStatusId = 'blue' | 'green' | 'yellow' | 'red' | 'purple';

export interface SmartStatus {
  statusId: SmartStatusId;
  colorHex: string;
  messageKey: string;
  usoSessao: number;
  minutosAtuais: number;
  minutosParaReset: number;
  momentoDoReset: number;
  workStartMin: number;
  workEndMin: number;
  breakStartMin: number;
  breakEndMin: number;
  resetCrossesDay: boolean;
  idealStartTime?: string;
  enabled: boolean;
}

function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function diffMinutesToReset(resetsAtIso: string, now: Date): number {
  const resetsAt = new Date(resetsAtIso);
  return Math.max(0, Math.floor((resetsAt.getTime() - now.getTime()) / 60000));
}

export function computeSmartStatus(
  schedule: WorkSchedule,
  usoSessao: number,
  resetsAtIso: string,
  now: Date = new Date(),
): SmartStatus {
  const { enabled, activeDays, workStart, workEnd, breakStart, breakEnd } = schedule;

  const minutosAtuais = now.getHours() * 60 + now.getMinutes();
  const diaAtual = now.getDay();
  const minutosParaReset = diffMinutesToReset(resetsAtIso, now);
  const momentoDoReset = minutosAtuais + minutosParaReset;

  const workStartMin = hhmmToMinutes(workStart);
  const workEndMin = hhmmToMinutes(workEnd);
  const breakStartMin = hhmmToMinutes(breakStart);
  const breakEndMin = hhmmToMinutes(breakEnd);
  const resetCrossesDay = momentoDoReset > workEndMin;

  const base = {
    usoSessao,
    minutosAtuais,
    minutosParaReset,
    momentoDoReset,
    workStartMin,
    workEndMin,
    breakStartMin,
    breakEndMin,
    resetCrossesDay,
    enabled,
  };

  // 1. BLUE
  if (!enabled || !activeDays.includes(diaAtual) || minutosAtuais < workStartMin || minutosAtuais > workEndMin) {
    return { ...base, statusId: 'blue', colorHex: '#3b82f6', messageKey: 'smartPlan.status.blue' };
  }

  // 2. PURPLE — dentro do expediente, sessão ainda não iniciada, dentro da janela de 90min antes do horário ideal
  // Não exibe sugestão se estivermos muito antes do horário ideal (ex: 02:40 sugerindo 08:00).
  if (usoSessao === 0) {
    const idealMin = Math.max(workStartMin, breakStartMin - 300);
    const isNearIdealWindow = minutosAtuais >= idealMin - 90 && minutosAtuais <= idealMin;
    if (isNearIdealWindow) {
      const idealH = Math.floor(idealMin / 60) % 24;
      const idealM = idealMin % 60;
      const idealStartTime = `${String(idealH).padStart(2, '0')}:${String(idealM).padStart(2, '0')}`;
      return { ...base, statusId: 'purple', colorHex: '#a855f7', messageKey: 'smartPlan.status.purple', idealStartTime };
    }
    // Fora da janela de sugestão acionável → cai para VERDE (pode iniciar quando precisar)
  }

  // 3. GREEN
  if (usoSessao <= 50 || (momentoDoReset >= breakStartMin && momentoDoReset <= breakEndMin)) {
    return { ...base, statusId: 'green', colorHex: '#22c55e', messageKey: 'smartPlan.status.green' };
  }

  // 4. RED
  if (usoSessao >= 85 && minutosParaReset > 45 && momentoDoReset < workEndMin) {
    return { ...base, statusId: 'red', colorHex: '#ef4444', messageKey: 'smartPlan.status.red' };
  }

  // 5. YELLOW (fallback)
  return { ...base, statusId: 'yellow', colorHex: '#eab308', messageKey: 'smartPlan.status.yellow' };
}
