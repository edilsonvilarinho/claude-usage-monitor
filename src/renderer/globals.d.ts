export interface WorkSchedule {
  enabled: boolean;
  activeDays: number[];
  workStart: string;
  workEnd: string;
  breakStart: string;
  breakEnd: string;
}

export type SmartStatusId = 'blue' | 'green' | 'yellow' | 'red';

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
  enabled: boolean;
}
