import type { AppSettings, WorkSchedule } from '../../../../services/settingsService';

export function bindSmartPlanTab(s: AppSettings): void {
  if (!s.workSchedule) return;
  const ws = s.workSchedule;
  (document.getElementById('sp-enabled') as HTMLInputElement).checked = ws.enabled;
  ws.activeDays.forEach(d => {
    const el = document.getElementById(`sp-day-${d}`) as HTMLInputElement;
    if (el) el.checked = true;
  });
  (document.getElementById('sp-work-start') as HTMLInputElement).value = ws.workStart;
  (document.getElementById('sp-work-end') as HTMLInputElement).value = ws.workEnd;
  (document.getElementById('sp-break-start') as HTMLInputElement).value = ws.breakStart;
  (document.getElementById('sp-break-end') as HTMLInputElement).value = ws.breakEnd;
}

export function readSmartPlanTab(): { workSchedule: WorkSchedule } {
  const activeDays = [0, 1, 2, 3, 4, 5, 6].filter(d => (document.getElementById(`sp-day-${d}`) as HTMLInputElement)?.checked);
  return {
    workSchedule: {
      enabled: (document.getElementById('sp-enabled') as HTMLInputElement).checked,
      activeDays,
      workStart: (document.getElementById('sp-work-start') as HTMLInputElement).value,
      workEnd: (document.getElementById('sp-work-end') as HTMLInputElement).value,
      breakStart: (document.getElementById('sp-break-start') as HTMLInputElement).value,
      breakEnd: (document.getElementById('sp-break-end') as HTMLInputElement).value,
    },
  };
}
