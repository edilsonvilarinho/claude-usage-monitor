import { sessionGauge, weeklyGauge, trayIcon } from '../../renderer/chartsInstance';
import { formatResetsIn, formatResetAt } from '../shared/formatters';
import { tr, getLang } from '../layouts/i18n';
import { fitWindow } from '../layouts/PopupLayout';

type UsageData = { five_hour: { utilization: number; resets_at: string }; seven_day: { utilization: number; resets_at: string } };

export function updateDashboard(data: UsageData, onResetsAtChange: (v: string) => void): void {
  const sessionPct = data.five_hour.utilization / 100;
  const weeklyPct = data.seven_day.utilization / 100;

  sessionGauge.update(sessionPct * 100);
  weeklyGauge.update(weeklyPct * 100);
  trayIcon.render(sessionPct * 100, weeklyPct * 100);

  const pctSessionEl = document.getElementById('pct-session');
  const pctWeeklyEl = document.getElementById('pct-weekly');
  const resetSessionEl = document.getElementById('reset-session');
  const resetAtSessionEl = document.getElementById('reset-at-session');
  const resetWeeklyEl = document.getElementById('reset-weekly');
  const resetAtWeeklyEl = document.getElementById('reset-at-weekly');

  if (pctSessionEl) pctSessionEl.textContent = `${Math.round(sessionPct * 100)}%`;
  if (pctWeeklyEl) pctWeeklyEl.textContent = `${Math.round(weeklyPct * 100)}%`;

  const resetAtSession = new Date(data.five_hour.resets_at);
  const resetAtWeekly = new Date(data.seven_day.resets_at);
  if (resetSessionEl) resetSessionEl.textContent = formatResetsIn(data.five_hour.resets_at, tr());
  if (resetAtSessionEl) resetAtSessionEl.textContent = formatResetAt(resetAtSession, getLang(), tr());
  if (resetWeeklyEl) resetWeeklyEl.textContent = formatResetsIn(data.seven_day.resets_at, tr());
  if (resetAtWeeklyEl) resetAtWeeklyEl.textContent = formatResetAt(resetAtWeekly, getLang(), tr());

  onResetsAtChange(data.seven_day.resets_at);

  const updatedEl = document.getElementById('updated-text');
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (updatedEl) updatedEl.textContent = tr().updatedAt(time);

  fitWindow();
}
