import { tr } from '../../layouts/i18n';

interface DailySnapshot { date: string; maxWeekly: number; maxSession: number; maxCredits?: number; sessionWindowCount?: number; sessionAccum?: number }

export class DailyChart {
  private onDayClick?: (date: string) => void;

  setDayClickHandler(handler: (date: string) => void): void {
    this.onDayClick = handler;
  }

  render(dailyData: DailySnapshot[], weeklyResetsAt: string, liveWeeklyPct?: number, liveSessionPct?: number): void {
    const container = document.getElementById('daily-chart');
    if (!container) return;

    const resetDate = new Date(weeklyResetsAt);
    const cycleStartMs = resetDate.getTime() - 7 * 24 * 60 * 60 * 1000;

    const hasCredits = dailyData.some(d => d.maxCredits !== undefined);
    const hasResets  = dailyData.some(d => (d.sessionWindowCount ?? 1) > 1);

    const slots: {
      date: string; label: string; isToday: boolean; isFuture: boolean;
      weeklyPct: number | null; sessionPct: number | null; creditsPct: number | null;
      sessionWindowCount: number; sessionAccum: number;
    }[] = [];
    const now = new Date();
    const todayStr = now.toLocaleDateString('sv');
    const locale = 'en';

    for (let i = 0; i < 7; i++) {
      const d = new Date(cycleStartMs + i * 24 * 60 * 60 * 1000);
      const dateStr = d.toLocaleDateString('sv');
      const label = d.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '');
      const isFuture = dateStr > todayStr;
      const isToday  = dateStr === todayStr;
      const found = dailyData.find(s => s.date === dateStr);
      slots.push({
        date: dateStr, label, isToday, isFuture,
        weeklyPct:    isToday && liveWeeklyPct !== undefined
          ? Math.min(liveWeeklyPct, 100)
          : found ? Math.min(found.maxWeekly, 100) : null,
        sessionPct:   isToday && liveSessionPct !== undefined
          ? Math.min(liveSessionPct, 100)
          : found ? Math.min(found.maxSession ?? 0, 100) : null,
        creditsPct:   (found && found.maxCredits !== undefined) ? Math.min(found.maxCredits, 100) : null,
        sessionWindowCount: found?.sessionWindowCount ?? 1,
        sessionAccum:  found?.sessionAccum  ?? 0,
      });
    }

    const t = tr();

    const legendEl = document.getElementById('daily-legend');
    if (legendEl) {
      legendEl.innerHTML = [
        `<span class="legend-dot session"></span><span class="legend-text">${t.sessionLabel}</span>`,
        `<span class="legend-dot weekly"></span><span class="legend-text">${t.weeklyLabel}</span>`,
        ...(hasCredits ? [`<span class="legend-dot credits"></span><span class="legend-text">${t.creditsLabel}</span>`] : []),
        ...(hasResets  ? [`<span class="legend-dot reset"></span><span class="legend-text">${t.resetLegendLabel}</span>`] : []),
      ].join('');
    }

    const BAR_MAX_PX = 40;
    container.innerHTML = slots.map(s => {
      const wPx = s.weeklyPct  !== null ? Math.max(3, Math.round((s.weeklyPct  / 100) * BAR_MAX_PX)) : 0;
      const accumTotal = s.sessionAccum + (s.sessionPct ?? 0);
      const totalSessionPct = Math.min(accumTotal, 100);
      const sPx = s.sessionPct !== null ? Math.max(3, Math.round((s.sessionPct / 100) * BAR_MAX_PX)) : 0;
      const cPx = s.creditsPct !== null ? Math.max(3, Math.round((s.creditsPct / 100) * BAR_MAX_PX)) : 0;
      const wClass = s.weeklyPct  !== null ? (s.weeklyPct  >= 80 ? 'crit' : s.weeklyPct  >= 60 ? 'warn' : 'ok') : '';
      const sClass = s.sessionPct !== null ? (s.sessionPct >= 80 ? 'crit' : s.sessionPct >= 60 ? 'warn' : 'ok') : '';
      const cClass = s.creditsPct !== null ? (s.creditsPct >= 80 ? 'crit' : s.creditsPct >= 60 ? 'warn' : '') : '';
      const todayClass  = s.isToday  ? ' today'  : '';
      const futureClass = s.isFuture ? ' future' : '';
      const creditsBar  = hasCredits
        ? `<div class="daily-bar credits ${cClass}" style="height:${cPx}px"></div>`
        : '';
      const resetBadge = (!s.isFuture && s.sessionWindowCount > 1)
        ? `<div class="reset-badge">${Math.max(0, s.sessionWindowCount - 1)}</div>`
        : '';

      let tooltipHtml = '';
      if (s.weeklyPct !== null) {
        const sessionLine = s.sessionPct !== null
          ? `<div><span class="tip-dot session"></span>${t.tooltipSession}: <b>${s.sessionPct}%</b></div>`
          : '';
        const resetLine = (s.sessionAccum > 0 || s.sessionWindowCount > 1)
          ? `<div class="tip-resets">${t.tooltipResets(Math.max(0, s.sessionWindowCount - 1))} · ${t.tooltipAccum(accumTotal)}</div>`
          : '';
        const weeklyLine = `<div><span class="tip-dot weekly"></span>${t.tooltipWeekly}: <b>${s.weeklyPct}%</b></div>`;
        const creditsLine = s.creditsPct !== null
          ? `<div><span class="tip-dot credits"></span>${t.tooltipCredits}: <b>${s.creditsPct}%</b></div>`
          : '';
        tooltipHtml = `<div class="daily-tooltip">${sessionLine}${resetLine}${weeklyLine}${creditsLine}</div>`;
      }

      return `<div class="daily-col${todayClass}${futureClass}" data-date="${s.date}">
        ${tooltipHtml}
        <div class="daily-bar-wrap">
          <div class="session-bar-slot">
            ${resetBadge}
            <div class="daily-bar session ${sClass}" style="height:${sPx}px"></div>
          </div>
          <div class="daily-bar weekly ${wClass}" style="height:${wPx}px"></div>
          ${creditsBar}
        </div>
        <span class="daily-day">${s.label}</span>
      </div>`;
    }).join('');

    container.querySelectorAll<HTMLElement>('.daily-col:not(.future)[data-date]').forEach(col => {
      col.addEventListener('click', () => {
        const date = col.dataset.date;
        if (date && this.onDayClick) {
          this.onDayClick(date);
        }
      });
    });
  }
}
