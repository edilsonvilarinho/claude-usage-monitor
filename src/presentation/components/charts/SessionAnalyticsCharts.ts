import {
  Chart,
  LineController, LineElement, PointElement, Filler,
  BarController, BarElement,
  CategoryScale, LinearScale,
  Tooltip, Legend,
} from 'chart.js';
import type { CliSession, SessionAnalytics } from '../../../domain/entities/Usage';

Chart.register(
  LineController, LineElement, PointElement, Filler,
  BarController, BarElement,
  CategoryScale, LinearScale,
  Tooltip, Legend,
);

let chartA: Chart | null = null;
let chartB: Chart | null = null;
let chartC: Chart | null = null;

function isDark(): boolean {
  const theme = document.body.dataset.theme;
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function themeColors(): { grid: string; labels: string } {
  return isDark()
    ? { grid: '#334155', labels: '#E2E8F0' }
    : { grid: '#E2E8F0', labels: '#475569' };
}

export function destroyAnalyticsCharts(): void {
  if (chartA) { chartA.destroy(); chartA = null; }
  if (chartB) { chartB.destroy(); chartB = null; }
  if (chartC) { chartC.destroy(); chartC = null; }
}

export function mountAnalyticsCharts(session: CliSession, analytics: SessionAnalytics): void {
  destroyAnalyticsCharts();

  const canvasA = document.getElementById('cli-chart-trend') as HTMLCanvasElement | null;
  const canvasB = document.getElementById('cli-chart-efficiency') as HTMLCanvasElement | null;
  if (!canvasA || !canvasB) return;

  const dark = isDark();
  const tc = themeColors();

  // ── Chart A: Cache read trend per turn ──────────────────────────────────────
  const turns = analytics.turns;
  const labels = turns.map((_, i) => String(i + 1));
  const values = turns.map((t) => t.cacheReadTokens);
  const lastVal = values[values.length - 1] ?? 0;
  const lineColor = lastVal > 150_000 ? '#EF4444' : '#10B981';
  const fillColor = lastVal > 150_000
    ? (dark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.15)')
    : (dark ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.15)');

  chartA = new Chart(canvasA, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: lineColor,
        backgroundColor: fillColor,
        borderWidth: 2,
        pointRadius: values.length > 20 ? 0 : 3,
        fill: 'origin',
        tension: 0.4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y as number;
              if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M tokens`;
              if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k tokens`;
              return `${v} tokens`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: tc.grid },
          ticks: { color: tc.labels, maxTicksLimit: 10 },
        },
        y: {
          grid: { color: tc.grid },
          ticks: {
            color: tc.labels,
            callback: (v) => {
              const n = Number(v);
              if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
              if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
              return String(n);
            },
          },
        },
      },
    },
  });

  // ── Chart B: Efficiency stacked bar ─────────────────────────────────────────
  const effectiveCost =
    session.inputTokens * (3.0 / 1_000_000) +
    session.outputTokens * (15.0 / 1_000_000) +
    session.cacheReadTokens * (0.30 / 1_000_000) +
    session.cacheCreationTokens * (3.75 / 1_000_000);
  const savings = analytics.cacheSavingsUSD;

  chartB = new Chart(canvasB, {
    type: 'bar',
    data: {
      labels: [''],
      datasets: [
        {
          label: 'Custo Efetivo',
          data: [effectiveCost],
          backgroundColor: dark ? 'rgba(96,165,250,0.8)' : 'rgba(59,130,246,0.75)',
          borderRadius: 4,
        },
        {
          label: 'Economia Gerada',
          data: [savings],
          backgroundColor: dark ? 'rgba(52,211,153,0.8)' : 'rgba(16,185,129,0.75)',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: tc.labels, boxWidth: 12, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y as number;
              return `${ctx.dataset.label}: $${v.toFixed(4)}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { color: tc.grid },
          ticks: { color: tc.labels },
        },
        y: {
          stacked: true,
          grid: { color: tc.grid },
          ticks: {
            color: tc.labels,
            callback: (v) => `$${Number(v).toFixed(2)}`,
          },
        },
      },
    },
  });

  // ── Chart C: Cache creation per turn ────────────────────────────────────────
  const canvasC = document.getElementById('cli-chart-cache-create') as HTMLCanvasElement | null;
  if (canvasC && turns.length > 0) {
    const createValues = turns.map((t) => t.cacheCreationTokens);
    const hasCreateData = createValues.some((v) => v > 0);
    if (hasCreateData) {
      chartC = new Chart(canvasC, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: createValues,
            borderColor: dark ? '#FBB024' : '#D97706',
            backgroundColor: dark ? 'rgba(251,191,36,0.2)' : 'rgba(217,119,6,0.15)',
            borderWidth: 2,
            pointRadius: createValues.length > 20 ? 0 : 3,
            fill: 'origin',
            tension: 0.4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed.y as number;
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M tokens`;
                  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k tokens`;
                  return `${v} tokens`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: tc.grid },
              ticks: { color: tc.labels, maxTicksLimit: 10 },
            },
            y: {
              grid: { color: tc.grid },
              ticks: {
                color: tc.labels,
                callback: (v) => {
                  const n = Number(v);
                  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
                  return String(n);
                },
              },
            },
          },
        },
      });
    }
  }

}
