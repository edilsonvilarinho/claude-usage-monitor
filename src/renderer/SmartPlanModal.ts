import { Chart } from 'chart.js';
import { applyTranslations, tr, getLang } from '../../presentation/layouts/i18n';
import { formatMinutes } from '../../presentation/shared/formatMinutes';
import { fitWindow } from '../../presentation/layouts/PopupLayout';
import type { SmartStatus } from '../globals';

let spDonutChart: Chart | null = null;
let currentSmartStatus: SmartStatus | null = null;

export function openSmartModalWithStatus(s: SmartStatus): void {
  applyTranslations();

  const modal = document.getElementById('smart-scheduler-modal')!;
  const t = tr() as Record<string, string>;

  const header = document.getElementById('sp-verdict-header')!;
  header.style.backgroundColor = s.colorHex;
  const verdictText = (t[s.messageKey] ?? s.messageKey).replace('{time}', s.idealStartTime ?? '');
  (document.getElementById('sp-verdict-text') as HTMLElement).textContent = verdictText;

  if (spDonutChart) { spDonutChart.destroy(); spDonutChart = null; }
  const canvas = document.getElementById('sp-donut') as HTMLCanvasElement;
  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#444';
  const pct = Math.min(Math.round(s.usoSessao), 100);
  (document.getElementById('sp-donut-pct') as HTMLElement).textContent = String(pct);
  spDonutChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [pct, Math.max(0, 100 - pct)],
        backgroundColor: [s.colorHex, borderColor],
        borderWidth: 0,
      }],
    },
    options: {
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: false,
    },
  });

  const timelineStartMin = Math.min(s.workStartMin, s.minutosAtuais, s.workEndMin);
  const timelineEndMin = Math.max(
    s.workEndMin,
    s.minutosAtuais,
    s.resetCrossesDay ? s.workEndMin : Math.min(s.momentoDoReset, 24 * 60)
  );
  const totalRange = timelineEndMin - timelineStartMin;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const pctOf = (min: number) => clamp((min - timelineStartMin) / totalRange * 100, 0, 100);

  const workBlock = document.getElementById('sp-work-block') as HTMLElement;
  workBlock.style.left = `${pctOf(s.workStartMin)}%`;
  workBlock.style.width = `${pctOf(s.workEndMin) - pctOf(s.workStartMin)}%`;

  (document.getElementById('sp-work-start-tick') as HTMLElement).style.left = `${pctOf(s.workStartMin)}%`;
  (document.getElementById('sp-work-end-tick') as HTMLElement).style.left = `${pctOf(s.workEndMin)}%`;

  const breakBlock = document.getElementById('sp-break-block') as HTMLElement;
  breakBlock.style.left = `${pctOf(s.breakStartMin)}%`;
  breakBlock.style.width = `${pctOf(s.breakEndMin) - pctOf(s.breakStartMin)}%`;

  const nowMarker = document.getElementById('sp-now-marker') as HTMLElement;
  nowMarker.style.left = `${pctOf(s.minutosAtuais)}%`;
  const nowLabel = document.getElementById('sp-now-label') as HTMLElement;
  nowLabel.style.left = `${pctOf(s.minutosAtuais)}%`;
  nowLabel.textContent = formatMinutes(s.minutosAtuais);

  const resetMarker = document.getElementById('sp-reset-marker') as HTMLElement;
  const resetLabel = document.getElementById('sp-reset-label') as HTMLElement;
  resetMarker.style.color = s.colorHex;
  if (s.resetCrossesDay) {
    const crossDayHHMM = formatMinutes(s.momentoDoReset % (24 * 60));
    const labelTemplate = t['smartPlan.resetNextDay'] ?? '+1d {time}';
    const label = labelTemplate.replace('{time}', crossDayHHMM);
    resetMarker.style.left = '100%';
    resetMarker.title = label;
    resetLabel.textContent = label;
    resetLabel.style.left = '100%';
    resetLabel.style.transform = 'translateX(-100%)';
    resetLabel.style.top = '-14px';
    resetLabel.style.color = s.colorHex;
    resetLabel.style.display = 'block';
  } else {
    const resetHHMMInline = formatMinutes(s.momentoDoReset % (24 * 60));
    const resetPct = pctOf(s.momentoDoReset);
    const endPct = pctOf(s.workEndMin);
    const startPct = pctOf(s.workStartMin);
    const nowPct = pctOf(s.minutosAtuais);
    const PROXIMITY = 10;

    const collidesWithOther =
      Math.abs(resetPct - endPct) < PROXIMITY ||
      Math.abs(resetPct - startPct) < PROXIMITY ||
      Math.abs(resetPct - nowPct) < PROXIMITY ||
      resetPct > 100 - PROXIMITY ||
      resetPct < PROXIMITY;

    resetMarker.style.left = `${resetPct}%`;
    resetMarker.title = resetHHMMInline;
    resetLabel.textContent = resetHHMMInline;
    resetLabel.style.left = `${resetPct}%`;
    resetLabel.style.top = collidesWithOther ? '-14px' : '26px';
    resetLabel.style.transform = 'translateX(-50%)';
    resetLabel.style.color = s.colorHex;
    resetLabel.style.display = 'block';
  }

  const tlStart = document.getElementById('sp-timeline-start') as HTMLElement;
  tlStart.textContent = formatMinutes(s.workStartMin);
  tlStart.style.left = `${pctOf(s.workStartMin)}%`;

  const tlEnd = document.getElementById('sp-timeline-end') as HTMLElement;
  tlEnd.textContent = formatMinutes(s.workEndMin);
  tlEnd.style.left = `${pctOf(s.workEndMin)}%`;

  const gap = (a: number, b: number) => Math.abs(pctOf(a) - pctOf(b));
  tlEnd.style.visibility = gap(s.workEndMin, s.minutosAtuais) < 10 ? 'hidden' : '';
  tlStart.style.visibility = gap(s.workStartMin, s.minutosAtuais) < 10 ? 'hidden' : '';

  const resetHHMM = formatMinutes(s.momentoDoReset % (24 * 60));
  const minBeforeEnd = s.workEndMin - s.momentoDoReset;
  let summary: string;
  if (s.resetCrossesDay) {
    summary = `${t['spSummaryResetAt'] ?? 'Sessão reinicia às'} ${resetHHMM} (+1d) — ${t['spSummaryAfterWork'] ?? 'após o fim do expediente'}`;
  } else if (minBeforeEnd > 0) {
    summary = `${t['spSummaryResetAt'] ?? 'Sessão reinicia às'} ${resetHHMM} · ${minBeforeEnd}min ${t['spSummaryBeforeEnd'] ?? 'antes do fim do expediente'}`;
  } else {
    summary = `${t['spSummaryResetAt'] ?? 'Sessão reinicia às'} ${resetHHMM}`;
  }
  (document.getElementById('sp-summary-text') as HTMLElement).textContent = summary;

  const legendReset = document.getElementById('sp-legend-reset-icon') as HTMLElement | null;
  if (legendReset) legendReset.style.color = s.colorHex;

  modal.classList.remove('hidden');

  requestAnimationFrame(() => {
    const box = modal.querySelector('.modal-box') as HTMLElement;
    const hdr = document.querySelector('.header') as HTMLElement;
    if (box && hdr) {
      const h = hdr.offsetHeight + box.offsetHeight + 48;
      window.claudeUsage.setWindowHeight(h);
    }
  });

  const closeModal = () => {
    modal.classList.add('hidden');
    fitWindow();
  };

  document.getElementById('sp-close-btn')?.addEventListener('click', closeModal, { once: true });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  }, { once: true });
}

export function applySmartIndicator(s: SmartStatus): void {
  const btn = document.getElementById('smart-indicator') as HTMLButtonElement | null;
  const recBar = document.getElementById('smart-rec-bar') as HTMLElement | null;
  if (!btn) return;
  if (!s.enabled) {
    btn.classList.add('hidden');
    if (recBar) recBar.classList.add('hidden');
    return;
  }
  btn.classList.remove('hidden');
  const dot = btn.querySelector('.smart-indicator-dot') as HTMLElement;
  if (dot) dot.style.background = s.colorHex;
  const t = tr() as Record<string, string>;
  const statusText = t[s.messageKey] ?? s.messageKey;
  const resolvedText = statusText.replace('{time}', s.idealStartTime ?? '');
  btn.title = resolvedText;
  if (recBar) {
    recBar.textContent = resolvedText;
    recBar.style.borderLeftColor = s.colorHex;
    recBar.classList.remove('hidden');
  }
}

export function setCurrentSmartStatus(s: SmartStatus): void {
  currentSmartStatus = s;
}

export function openSmartModal(): void {
  if (!currentSmartStatus) return;
  openSmartModalWithStatus(currentSmartStatus);
}