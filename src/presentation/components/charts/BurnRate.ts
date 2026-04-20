export class BurnRate {
  async updateSession(): Promise<void> {
    const el = document.getElementById('burn-rate-line');
    if (!el) return;

    const today = new Date().toLocaleDateString('sv');
    const points = await window.claudeUsage.getDayTimeSeries(today);
    if (points.length < 2) { el.textContent = ''; return; }

    const newest = points[points.length - 1];
    const minWindowMs = 10 * 60_000;
    const oldest = [...points].slice(0, -1).reverse().find(p => newest.ts - p.ts >= minWindowMs)
      ?? points[points.length - 2];

    const currentSession = newest.session;
    if (currentSession < 5) { el.textContent = ''; return; }

    const deltaPct = newest.session - oldest.session;
    const deltaHours = (newest.ts - oldest.ts) / 3_600_000;
    if (deltaHours <= 0) { el.textContent = ''; return; }

    const burnRate = deltaPct / deltaHours;
    if (burnRate <= 0) { el.textContent = ''; return; }

    const remainingPct = 100 - currentSession;
    const hoursUntilFull = remainingPct / burnRate;
    if (hoursUntilFull > 6) { el.textContent = ''; return; }

    const estTime = new Date(newest.ts + hoursUntilFull * 3_600_000);
    const timeStr = estTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const rateStr = burnRate.toFixed(1);
    const isPtBR = document.documentElement.lang === 'pt-BR' || navigator.language.startsWith('pt');
    el.textContent = isPtBR
      ? `↑ ${rateStr}%/h · esgota ~${timeStr}`
      : `↑ ${rateStr}%/h · exhausts ~${timeStr}`;
  }

  async updateWeekly(): Promise<void> {
    const el = document.getElementById('burn-rate-line-weekly');
    if (!el) return;

    const today = new Date().toLocaleDateString('sv');
    const points = await window.claudeUsage.getDayTimeSeries(today);
    if (points.length < 2) { el.textContent = ''; return; }

    const newest = points[points.length - 1];
    const minWindowMs = 10 * 60_000;
    const oldest = [...points].slice(0, -1).reverse().find(p => newest.ts - p.ts >= minWindowMs)
      ?? points[points.length - 2];

    const currentWeekly = newest.weekly;
    if (currentWeekly < 5) { el.textContent = ''; return; }

    const deltaPct = newest.weekly - oldest.weekly;
    const deltaHours = (newest.ts - oldest.ts) / 3_600_000;
    if (deltaHours <= 0) { el.textContent = ''; return; }

    const burnRate = deltaPct / deltaHours;
    if (burnRate <= 0) { el.textContent = ''; return; }

    const remainingPct = 100 - currentWeekly;
    const hoursUntilFull = remainingPct / burnRate;
    if (hoursUntilFull > 48) { el.textContent = ''; return; }

    const estTime = new Date(newest.ts + hoursUntilFull * 3_600_000);
    const isPtBR = document.documentElement.lang === 'pt-BR' || navigator.language.startsWith('pt');
    const now = new Date();
    const isToday = estTime.toLocaleDateString('sv') === now.toLocaleDateString('sv');
    let timeStr: string;
    if (isToday) {
      timeStr = estTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      const weekday = estTime.toLocaleDateString(isPtBR ? 'pt-BR' : 'en', { weekday: 'short' });
      const t = estTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      timeStr = `${weekday} ${t}`;
    }
    const rateStr = burnRate.toFixed(1);
    el.textContent = isPtBR
      ? `↑ ${rateStr}%/h · esgota ~${timeStr}`
      : `↑ ${rateStr}%/h · exhausts ~${timeStr}`;
  }
}
