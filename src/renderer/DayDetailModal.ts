import { Chart } from 'chart.js';
import { getLang, tr } from '../presentation/layouts/i18n';
import { filterChangedPoints } from '../presentation/shared/timeSeries';

let dayDetailChart: Chart | null = null;

export async function openDayDetailModal(date: string): Promise<void> {
  const modal    = document.getElementById('day-detail-modal')!;
  const titleEl  = document.getElementById('day-detail-title')!;
  const emptyEl  = document.getElementById('day-detail-empty')!;
  const canvas   = document.getElementById('day-detail-canvas') as HTMLCanvasElement;

  const d = new Date(date + 'T12:00:00');
  const locale = getLang() === 'pt-BR' ? 'pt-BR' : 'en';
  titleEl.textContent = tr().dayDetailTitle(d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' }));

  if (dayDetailChart) { dayDetailChart.destroy(); dayDetailChart = null; }

  modal.classList.remove('hidden');

  const [points, windows] = await Promise.all([
    window.claudeUsage.getDayTimeSeries(date),
    window.claudeUsage.getSessionWindows(),
  ]);

  const exportBtn = document.getElementById('day-detail-export') as HTMLButtonElement;
  exportBtn.style.display = points && points.length > 0 ? '' : 'none';
  exportBtn.onclick = () => {
    const filtered = filterChangedPoints(points);
    const payload = {
      date,
      exportedAt: new Date().toISOString(),
      totalPoints: points.length,
      filteredPoints: filtered.length,
      timeSeries: filtered.map(p => ({
        ts: p.ts,
        time: new Date(p.ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
        session: p.session,
        weekly: p.weekly,
        ...(p.credits != null ? { credits: p.credits } : {}),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claude-usage-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!points || points.length === 0) {
    canvas.style.display = 'none';
    emptyEl.textContent = tr().dayDetailEmpty;
    emptyEl.classList.remove('hidden');
    return;
  }

  canvas.style.display = '';
  emptyEl.classList.add('hidden');

  const tickColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#aaa';
  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark'
    || (document.documentElement.getAttribute('data-theme') === null && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const sessionBorder = '#a78bfa';
  const weeklyBorder  = '#60a5fa';
  const creditsBorder = '#22c55e';
  const sessionFill   = isDarkMode ? 'rgba(167,139,250,0.38)' : 'rgba(167,139,250,0.22)';
  const weeklyFill    = isDarkMode ? 'rgba(96,165,250,0.28)'  : 'rgba(96,165,250,0.15)';
  const creditsFill   = isDarkMode ? 'rgba(34,197,94,0.28)'   : 'rgba(34,197,94,0.15)';

  const labels  = points.map(p => new Date(p.ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }));
  const session = points.map(p => Math.min(p.session, 100));
  const weekly  = points.map(p => Math.min(p.weekly,  100));
  const credits = points.map(p => p.credits != null ? Math.min(p.credits, 100) : null);
  const hasCredits = credits.some(v => v !== null);

  const resets = (windows ?? []).filter(w => w.date === date);

  const resetPlugin = {
    id: 'resetLines',
    afterDraw(chart: Chart) {
      const ctx  = chart.ctx;
      const xAxis = chart.scales['x'];
      const yAxis = chart.scales['y'];
      resets.forEach(w => {
        const resetTs = new Date(w.resetsAt).getTime();
        let closest = 0;
        let minDiff = Infinity;
        points.forEach((p, i) => {
          const diff = Math.abs(p.ts - resetTs);
          if (diff < minDiff) { minDiff = diff; closest = i; }
        });
        const x = xAxis.getPixelForValue(closest);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, yAxis.top);
        ctx.lineTo(x, yAxis.bottom);
        ctx.strokeStyle = 'rgba(249,115,22,0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.restore();
      });
    },
  };

  dayDetailChart = new Chart(canvas, {
    type: 'line',
    plugins: [resetPlugin],
    data: {
      labels,
      datasets: [
        {
          label: tr().dayDetailSession,
          data: session,
          borderColor: sessionBorder,
          backgroundColor: sessionFill,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: tr().dayDetailWeekly,
          data: weekly,
          borderColor: weeklyBorder,
          backgroundColor: weeklyFill,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
        ...(hasCredits ? [{
          label: tr().dayDetailCredits,
          data: credits,
          borderColor: creditsBorder,
          backgroundColor: creditsFill,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
          spanGaps: true,
        }] : []),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          ticks: { maxTicksLimit: 6, color: tickColor, font: { size: 10 } },
          grid: { color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
        },
        y: {
          min: 0,
          max: 100,
          ticks: { stepSize: 25, color: tickColor, font: { size: 10 }, callback: (v) => `${v}%` },
          grid: { color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
        },
      },
      plugins: {
        legend: {
          display: true,
          labels: { color: isDarkMode ? '#d0d0d0' : '#555555', font: { size: 10 }, boxWidth: 10, padding: 8 },
        },
        tooltip: { mode: 'index', intersect: false },
      },
    },
  });
}

export function closeDayDetailModal(): void {
  document.getElementById('day-detail-modal')?.classList.add('hidden');
  if (dayDetailChart) { dayDetailChart.destroy(); dayDetailChart = null; }
}