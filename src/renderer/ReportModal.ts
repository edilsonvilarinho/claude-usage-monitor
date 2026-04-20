import { Chart } from 'chart.js';
import { getLang, tr } from '../presentation/layouts/i18n';
import { showConfirm } from '../presentation/components/modals/GenericModals';

let reportChart: Chart | null = null;

export async function openReportModal(): Promise<void> {
  const modal = document.getElementById('report-modal')!;
  modal.classList.remove('hidden');

  const isPtBRHeader = getLang() === 'pt-BR';
  const headerEl = modal.querySelector('.day-detail-header')!;
  if (!headerEl.querySelector('#btn-clear-report')) {
    const clearBtn = document.createElement('button');
    clearBtn.id = 'btn-clear-report';
    clearBtn.className = 'report-clear-btn';
    clearBtn.textContent = isPtBRHeader ? 'Limpar tudo' : 'Clear all';
    clearBtn.onclick = async () => {
      const msg = isPtBRHeader
        ? 'Apagar todo o histórico e janelas de sessão? Essa ação não pode ser desfeita.'
        : 'Delete all history and session windows? This cannot be undone.';
      const ok = await showConfirm(
        msg,
        isPtBRHeader ? 'Limpar' : 'Clear',
        isPtBRHeader ? 'Cancelar' : 'Cancel',
      );
      if (!ok) return;
      await window.claudeUsage.clearAllReportData();
      await openReportModal();
    };
    headerEl.insertBefore(clearBtn, headerEl.querySelector('#btn-close-report'));
  }

  const [dailyHistory, sessionWindows, currentWindow] = await Promise.all([
    window.claudeUsage.getDailyHistory(),
    window.claudeUsage.getSessionWindows(),
    window.claudeUsage.getCurrentSessionWindow(),
  ]);

  const sorted = [...(dailyHistory ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  const locale = getLang() === 'pt-BR' ? 'pt-BR' : 'en';
  const labels = sorted.map(d => {
    const dt = new Date(d.date + 'T12:00:00');
    return dt.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  });
  const sessionData = sorted.map(d => Math.min(d.maxSession, 200));
  const weeklyData  = sorted.map(d => Math.min(d.maxWeekly,  200));

  const peakSession = sorted.length ? Math.max(...sorted.map(d => d.maxSession)) : 0;
  const avgSession  = sorted.length ? Math.round(sorted.reduce((s, d) => s + d.maxSession, 0) / sorted.length) : 0;
  const totalWindows = (sessionWindows ?? []).length + (currentWindow ? 1 : 0);
  const allPeaks = [...(sessionWindows ?? []).map(w => w.peak), ...(currentWindow ? [currentWindow.peak] : [])];
  const peakWindow = allPeaks.length ? Math.max(...allPeaks) : 0;

  const tickColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#aaa';
  const gridColor = 'rgba(128,128,128,0.15)';

  if (reportChart) { reportChart.destroy(); reportChart = null; }

  const canvas = document.getElementById('report-chart') as HTMLCanvasElement;
  reportChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: getLang() === 'pt-BR' ? 'Sessão pico' : 'Session peak',
          data: sessionData,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.12)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#22c55e',
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: tickColor, font: { size: 10 }, boxWidth: 10, padding: 10 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}%`,
          },
        },
      },
      scales: {
        y: {
          min: 0,
          max: Math.max(100, peakSession + 10, peakWindow + 10),
          ticks: { color: tickColor, font: { size: 9 }, callback: v => `${v}%` },
          grid: { color: gridColor },
        },
        x: {
          ticks: { color: tickColor, font: { size: 9 }, maxRotation: 45 },
          grid: { color: gridColor },
        },
      },
    },
  });

  const statsEl = document.getElementById('report-stats')!;
  const statItems = getLang() === 'pt-BR'
    ? [
        { label: 'Dias monitorados', value: `${sorted.length}` },
        { label: 'Pico de sessão',   value: `${peakSession}%` },
        { label: 'Média de sessão',  value: `${avgSession}%` },
        { label: 'Janelas de sessão', value: `${totalWindows}` },
      ]
    : [
        { label: 'Monitored days',   value: `${sorted.length}` },
        { label: 'Session peak',     value: `${peakSession}%` },
        { label: 'Session average',  value: `${avgSession}%` },
        { label: 'Session windows',  value: `${totalWindows}` },
      ];
  statsEl.innerHTML = statItems
    .map(s => `<div class="stat-card"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`)
    .join('');

  const windowsEl = document.getElementById('report-windows')!;
  const isPtBR = getLang() === 'pt-BR';
  const fmt = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const recentWindows = [...(sessionWindows ?? [])].reverse().slice(0, 10);

  if (recentWindows.length === 0 && !currentWindow) {
    windowsEl.innerHTML = '';
  } else {
    const windowsTitle = isPtBR ? 'Janelas recentes (5h)' : 'Recent windows (5h)';

    const buildRow = (resetsAt: string, peak: number, final: number, index: number, isOpen: boolean, peakTs?: number) => {
      const endDt   = new Date(resetsAt);
      const startDt = new Date(endDt.getTime() - 5 * 60 * 60 * 1000);
      const fmtDate = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
      const startStr = `${fmtDate(startDt)} ${fmt(startDt)}`;
      const hasActivity = peak > 0 || final > 0;
      const effectiveIsOpen = isOpen && hasActivity;
      const rangeStr = effectiveIsOpen
        ? `${startStr} → ${isPtBR ? 'em andamento' : 'ongoing'}`
        : `${startStr} → ${fmtDate(endDt)} ${fmt(endDt)}`;
      const pct   = Math.min(final, 200);
      const color = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e';
      const label = isPtBR ? `Janela ${index}` : `Window ${index}`;
      const badge = effectiveIsOpen
        ? `<span class="window-badge open">${isPtBR ? 'Aberta' : 'Open'}</span>`
        : `<span class="window-badge closed">${isPtBR ? 'Fechada' : 'Closed'}</span>`;
      const peakTimeStr = peakTs
        ? new Date(peakTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null;
      const peakTimeHtml = peakTimeStr
        ? `<span class="window-peak-time">${isPtBR ? 'pico' : 'peak at'} ${peakTimeStr}</span>`
        : '';
      const deleteBtn = !effectiveIsOpen
        ? `<button class="window-delete-btn" data-resets-at="${resetsAt}" title="${isPtBR ? 'Remover' : 'Remove'}">🗑</button>`
        : '';
      return `<div class="report-window-row">
        <span class="report-window-label">${label} ${badge}</span>
        <span class="report-window-date">${rangeStr}</span>
        <span class="report-window-peak" style="color:${color}">${pct}%${peakTimeHtml}</span>
        ${deleteBtn}
      </div>`;
    };

    let windowRows = '';
    let idx = 1;
    if (currentWindow) {
      windowRows += buildRow(currentWindow.resetsAt, currentWindow.peak, currentWindow.final ?? currentWindow.peak, idx++, true, currentWindow.peakTs);
    }
    windowRows += recentWindows.map(w => buildRow(w.resetsAt, w.peak, w.final ?? w.peak, idx++, false, w.peakTs)).join('');

    windowsEl.innerHTML = `<div class="report-windows-title">${windowsTitle}</div>` + windowRows;

    windowsEl.querySelectorAll<HTMLButtonElement>('.window-delete-btn').forEach(btn => {
      btn.onclick = async () => {
        const ok = await showConfirm(
          isPtBR ? 'Remover esta janela de sessão?' : 'Remove this session window?',
          isPtBR ? 'Remover' : 'Remove',
          isPtBR ? 'Cancelar' : 'Cancel',
        );
        if (!ok) return;
        await window.claudeUsage.deleteSessionWindow(btn.dataset.resetsAt!);
        await openReportModal();
      };
    });
  }

  const analyticsEl = document.getElementById('report-analytics');
  if (analyticsEl) {
    const today = new Date().toLocaleDateString('sv');
    const allW = [...recentWindows] as { resetsAt: string; peak: number; date: string; peakTs?: number }[];
    if (currentWindow) allW.push({ resetsAt: currentWindow.resetsAt, peak: currentWindow.peak, date: today, peakTs: currentWindow.peakTs });

    const byDate = new Map<string, number>();
    allW.forEach(w => byDate.set(w.date, (byDate.get(w.date) ?? 0) + 1));
    const avgPerDay = byDate.size > 0
      ? (Array.from(byDate.values()).reduce((a, b) => a + b, 0) / byDate.size).toFixed(1)
      : '—';

    const withPeak = allW.filter(w => w.peakTs != null);
    let peakInterval = '—';
    if (withPeak.length > 0) {
      const hourBuckets = new Array(24).fill(0) as number[];
      withPeak.forEach(w => hourBuckets[new Date(w.peakTs!).getHours()]++);
      const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));
      peakInterval = `${String(peakHour).padStart(2,'0')}h–${String(peakHour+1).padStart(2,'0')}h`;
    }

    const sortedDH = [...dailyHistory].sort((a, b) => a.date.localeCompare(b.date));
    let streak = 0;
    for (let i = sortedDH.length - 1; i >= 0; i--) {
      if (sortedDH[i].maxSession >= 80) streak++;
      else break;
    }

    analyticsEl.innerHTML = `
      <div class="analytics-title">${isPtBR ? 'Resumo' : 'Summary'}</div>
      <div class="stat-card"><div class="stat-value">${avgPerDay}</div><div class="stat-label">${isPtBR ? 'Janelas/dia' : 'Windows/day'}</div></div>
      <div class="stat-card"><div class="stat-value">${peakInterval}</div><div class="stat-label">${isPtBR ? 'Pico comum' : 'Common peak'}</div></div>
      <div class="stat-card"><div class="stat-value">${streak}</div><div class="stat-label">${isPtBR ? 'Dias >80%' : 'Days >80%'}</div></div>
    `;
  }
}