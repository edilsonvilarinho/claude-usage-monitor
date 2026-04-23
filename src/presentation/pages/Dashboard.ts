import { sessionGauge, weeklyGauge, trayIcon } from '../../renderer/chartsInstance';
import { formatResetsIn, formatResetAt } from '../shared/formatters';
import { tr, getLang } from '../layouts/i18n';
import { fitWindow } from '../layouts/PopupLayout';
import { appStore } from '../../renderer/stores/appStore';

type UsageWindow = { utilization: number; resets_at: string };
type ExtraUsage = { is_enabled: boolean; monthly_limit: number; used_credits: number };
type UsageData = { five_hour: UsageWindow; seven_day: UsageWindow; seven_day_sonnet?: UsageWindow; extra_usage?: ExtraUsage };

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

  const sonnetRow = document.getElementById('sonnet-row');
  if (sonnetRow) {
    if (data.seven_day_sonnet) {
      const pct = Math.min(100, data.seven_day_sonnet.utilization);
      const bar = document.getElementById('bar-sonnet');
      const label = document.getElementById('pct-sonnet');
      if (bar) bar.style.width = `${pct}%`;
      if (label) label.textContent = `${Math.round(pct)}%`;
      sonnetRow.style.display = '';
    } else {
      sonnetRow.style.display = 'none';
    }
  }

  const creditsRow = document.getElementById('credits-row');
  if (creditsRow) {
    const ex = data.extra_usage;
    if (ex?.is_enabled && ex.monthly_limit > 0) {
      const pct = Math.min(100, (ex.used_credits / ex.monthly_limit) * 100);
      const bar = document.getElementById('bar-credits');
      const label = document.getElementById('pct-credits');
      if (bar) bar.style.width = `${pct}%`;
      if (label) label.textContent = `${Math.round(pct)}%`;
      creditsRow.style.display = '';
    } else {
      creditsRow.style.display = 'none';
    }
  }

  const extraSection = document.getElementById('extra-section');
  const sonnetVisible = sonnetRow?.style.display !== 'none';
  const creditsVisible = creditsRow?.style.display !== 'none';
  const showExtras = appStore.get('extraSectionAllowed') !== false;
  if (extraSection) {
    extraSection.style.display = (sonnetVisible || creditsVisible) && showExtras ? '' : 'none';
  }

  const updatedEl = document.getElementById('updated-text');
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (updatedEl) updatedEl.textContent = tr().updatedAt(time);

  fitWindow();
}
