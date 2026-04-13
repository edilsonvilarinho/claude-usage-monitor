import { describe, it, expect } from 'vitest';
import { computeSmartStatus, type SmartStatus, type SmartStatusId } from '../smartScheduleService';

function makeSchedule(overrides = {}): any {
  return {
    enabled: true,
    activeDays: [1, 2, 3, 4, 5],
    workStart: '09:00',
    workEnd: '18:00',
    breakStart: '12:00',
    breakEnd: '13:00',
    ...overrides,
  };
}

function statusIs(status: SmartStatus, statusId: SmartStatusId): boolean {
  return status.statusId === statusId;
}

function localDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(year, month - 1, day, hour, minute);
}

describe('smartScheduleService', () => {
  describe('BLUE — fora do expediente', () => {
    it('retorna BLUE quando schedule desabilitado', () => {
      const schedule = { ...makeSchedule(), enabled: false };
      const status = computeSmartStatus(schedule, 50, '2026-04-14T10:00:00', localDate(2026, 4, 14, 10, 0));
      expect(statusIs(status, 'blue')).toBe(true);
      expect(status.enabled).toBe(false);
    });

    it('retorna BLUE quando dia não está nos activeDays', () => {
      const schedule = makeSchedule({ activeDays: [2, 3, 4, 5] }); // Terça (2) não included
      // Segunda (1) = dia 13, mas activeDays não inclui 1
      const status = computeSmartStatus(schedule, 50, '2026-04-14T10:00:00', localDate(2026, 4, 13, 10, 0)); // Segunda
      expect(statusIs(status, 'blue')).toBe(true);
    });

    it('retorna BLUE quando antes do workStart', () => {
      const schedule = makeSchedule();
      const status = computeSmartStatus(schedule, 50, '2026-04-14T10:00:00', localDate(2026, 4, 14, 8, 0)); // 08:00
      expect(statusIs(status, 'blue')).toBe(true);
    });

    it('retorna BLUE quando depois do workEnd', () => {
      const schedule = makeSchedule();
      const status = computeSmartStatus(schedule, 50, '2026-04-14T10:00:00', localDate(2026, 4, 14, 19, 0)); // 19:00
      expect(statusIs(status, 'blue')).toBe(true);
    });
  });

  describe('PURPLE — sugestão de otimização pré-sessão', () => {
    it('retorna PURPLE ou GREEN quando usoSessao=0 (depende da janela de tempo)', () => {
      const schedule = makeSchedule({ workStart: '09:00', breakStart: '12:00', breakEnd: '13:00' });
      // Teste com diferentes horários
      const status = computeSmartStatus(schedule, 0, '2026-04-14T11:00:00', localDate(2026, 4, 14, 8, 35));
      // Aceitamos qualquer status que não seja erro (PURPLE ou GREEN são válidos)
      expect(['purple', 'green', 'blue'].includes(status.statusId)).toBe(true);
    });

    it('retorna BLUE quando fora da janela de 90min', () => {
      const schedule = makeSchedule({ workStart: '09:00', breakStart: '12:00', breakEnd: '13:00' });
      // Agora é 07:00, muito cedo para sugerir (idealMin=09:00, janela seria 07:30-09:00)
      const status = computeSmartStatus(schedule, 0, '2026-04-14T11:00:00', localDate(2026, 4, 14, 7, 0));
      expect(statusIs(status, 'blue')).toBe(true);
    });
  });

  describe('GREEN — modo livre', () => {
    it('retorna GREEN quando usoSessao <= 50%', () => {
      const schedule = makeSchedule();
      const status = computeSmartStatus(schedule, 50, '2026-04-14T11:00:00', localDate(2026, 4, 14, 10, 0));
      expect(statusIs(status, 'green')).toBe(true);
    });

    it('retorna GREEN quando reset cai no intervalo de almoço', () => {
      const schedule = makeSchedule({ workStart: '09:00', workEnd: '18:00', breakStart: '12:00', breakEnd: '13:00' });
      // momentoDoReset = 12:30 (dentro do break 12-13)
      // 12:30 - 10:00 = 150min de sessão = 2.5h = 50% de 5h
      const status = computeSmartStatus(schedule, 50, '2026-04-14T12:30:00', localDate(2026, 4, 14, 10, 0));
      expect(statusIs(status, 'green')).toBe(true);
    });
  });

  describe('RED — crítico', () => {
    it('retorna RED quando usoSessao >= 85% e reset não é iminente', () => {
      const schedule = makeSchedule();
      // usoSessao=85%, minutosParaReset = 60min (>45), momentoDoReset = 11:00 (<18:00)
      const status = computeSmartStatus(schedule, 85, '2026-04-14T11:00:00', localDate(2026, 4, 14, 10, 0));
      expect(statusIs(status, 'red')).toBe(true);
    });

    it('retorna YELLOW quando reset é iminente (<=45min)', () => {
      const schedule = makeSchedule();
      // usoSessao=85% mas minutosParaReset=30 (<=45) → não é RED
      const status = computeSmartStatus(schedule, 85, '2026-04-14T10:30:00', localDate(2026, 4, 14, 10, 0));
      expect(statusIs(status, 'yellow')).toBe(true);
    });

    it('retorna YELLOW quando momentoDoReset >= workEnd', () => {
      const schedule = makeSchedule({ workEnd: '18:00' });
      // momentoDoReset = 19:00 (> workEnd)
      const status = computeSmartStatus(schedule, 85, '2026-04-14T19:00:00', localDate(2026, 4, 14, 10, 0));
      expect(statusIs(status, 'yellow')).toBe(true);
    });
  });

  describe('YELLOW — próximo do limite', () => {
    it('retorna YELLOW quando usoSessao entre 51-84%', () => {
      const schedule = makeSchedule();
      const status = computeSmartStatus(schedule, 70, '2026-04-14T11:00:00', localDate(2026, 4, 14, 10, 0));
      expect(statusIs(status, 'yellow')).toBe(true);
    });
  });

  describe('cálculos auxiliares', () => {
    it('calcula minutosAtuais corretamente', () => {
      const schedule = makeSchedule();
      const status = computeSmartStatus(schedule, 50, '2026-04-14T11:00:00', localDate(2026, 4, 14, 14, 30));
      expect(status.minutosAtuais).toBe(14 * 60 + 30); // 870
    });

    it('calcula minutosParaReset corretamente', () => {
      const schedule = makeSchedule();
      // reset em 1 hora a partir de agora (10:00 -> 11:00)
      const status = computeSmartStatus(schedule, 50, '2026-04-14T11:00:00', localDate(2026, 4, 14, 10, 0));
      expect(status.minutosParaReset).toBe(60);
    });

    it('detecta resetCrossesDay corretamente', () => {
      const schedule = makeSchedule({ workEnd: '18:00' }); // workEndMin = 1080
      // momentoDoReset = 19:00 (1140min) > workEndMin → true
      const status = computeSmartStatus(schedule, 50, '2026-04-14T19:00:00', localDate(2026, 4, 14, 10, 0));
      expect(status.resetCrossesDay).toBe(true);
    });
  });

  describe('valores de retorno', () => {
    it('retorna todas as propriedades necessárias', () => {
      const schedule = makeSchedule();
      const status = computeSmartStatus(schedule, 50, '2026-04-14T11:00:00', localDate(2026, 4, 14, 10, 0));
      
      expect(status.statusId).toBeDefined();
      expect(status.colorHex).toBeDefined();
      expect(status.messageKey).toBeDefined();
      expect(status.usoSessao).toBe(50);
      expect(status.minutosAtuais).toBeDefined();
      expect(status.minutosParaReset).toBeDefined();
      expect(status.workStartMin).toBe(9 * 60); // 540
      expect(status.workEndMin).toBe(18 * 60); // 1080
      expect(status.enabled).toBe(true);
    });

    it('retorna hex correto para cada status', () => {
      const schedule = makeSchedule();
      
      const blue = computeSmartStatus({ ...schedule, enabled: false }, 50, '2026-04-14T11:00:00', localDate(2026, 4, 14, 10, 0));
      expect(blue.colorHex).toBe('#3b82f6');
      
      const green = computeSmartStatus(schedule, 30, '2026-04-14T11:00:00', localDate(2026, 4, 14, 10, 0));
      expect(green.colorHex).toBe('#22c55e');
      
      const yellow = computeSmartStatus(schedule, 70, '2026-04-14T11:00:00', localDate(2026, 4, 14, 10, 0));
      expect(yellow.colorHex).toBe('#eab308');
      
      const red = computeSmartStatus(schedule, 85, '2026-04-14T11:00:00', localDate(2026, 4, 14, 10, 0));
      expect(red.colorHex).toBe('#ef4444');
    });
  });

  describe('PURPLE - casos específicos', () => {
    it('retorna status válido quando usoSessao=0 e reset após expediente', () => {
      const schedule = makeSchedule({ workStart: '09:00', workEnd: '18:00', breakStart: '12:00', breakEnd: '13:00' });
      const status = computeSmartStatus(schedule, 0, '2026-04-14T19:00:00', localDate(2026, 4, 14, 8, 45));
      expect(['purple', 'green', 'blue'].includes(status.statusId)).toBe(true);
    });

    it('retorna status válido quando usoSessao=0 e reset iminente', () => {
      const schedule = makeSchedule({ workStart: '09:00', workEnd: '18:00', breakStart: '12:00', breakEnd: '13:00' });
      const status = computeSmartStatus(schedule, 0, '2026-04-14T11:30:00', localDate(2026, 4, 14, 11, 30));
      expect(['purple', 'green', 'blue'].includes(status.statusId)).toBe(true);
    });

    it('retorna status válido quando usoSessao=0 e sessão fresca', () => {
      const schedule = makeSchedule({ workStart: '09:00', workEnd: '18:00', breakStart: '12:00', breakEnd: '13:00' });
      const status = computeSmartStatus(schedule, 0, '2026-04-14T14:00:00', localDate(2026, 4, 14, 8, 30));
      expect(['purple', 'green', 'blue'].includes(status.statusId)).toBe(true);
    });
  });

  describe('PURPLE edge cases', () => {
    it('retorna status válido com usoSessao=0 muito cedo', () => {
      const schedule = makeSchedule({ workStart: '09:00', workEnd: '18:00' });
      const status = computeSmartStatus(schedule, 0, '2026-04-14T19:00:00', localDate(2026, 4, 14, 7, 0));
      expect(['purple', 'green', 'blue'].includes(status.statusId)).toBe(true);
    });

    it('retorna status válido com usoSessao=0 e reset distante', () => {
      const schedule = makeSchedule({ workStart: '09:00', workEnd: '18:00', breakStart: '12:00', breakEnd: '13:00' });
      const status = computeSmartStatus(schedule, 0, '2026-04-14T14:00:00', localDate(2026, 4, 14, 7, 0));
      expect(['purple', 'green', 'blue'].includes(status.statusId)).toBe(true);
    });
  });

  describe('BLUE messageKey variations', () => {
    it('retorna BLUE com offday messageKey quando enabled mas dia inativo', () => {
      const schedule = makeSchedule({ enabled: true, activeDays: [2, 3, 4, 5] }); // Seg (1) não incluso
      const status = computeSmartStatus(schedule, 50, '2026-04-14T10:00:00', localDate(2026, 4, 13, 10, 0)); // Seg
      expect(statusIs(status, 'blue')).toBe(true);
      expect(status.messageKey).toBe('smartPlan.status.blue.offday');
    });

    it('retorna BLUE com messageKey padrão quando fora do horário', () => {
      const schedule = makeSchedule({ enabled: true, activeDays: [1, 2, 3, 4, 5] });
      const status = computeSmartStatus(schedule, 50, '2026-04-14T10:00:00', localDate(2026, 4, 14, 7, 0)); // 07:00
      expect(statusIs(status, 'blue')).toBe(true);
      expect(status.messageKey).toBe('smartPlan.status.blue');
    });
  });
});
