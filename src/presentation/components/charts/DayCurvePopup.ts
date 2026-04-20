import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

export class DayCurvePopup {
  private chart: Chart | null = null;
  private openDate: string | null = null;

  async open(date: string): Promise<void> {
    const overlay = document.getElementById('day-curve-overlay') as HTMLElement;
    const titleEl = document.getElementById('day-curve-title') as HTMLElement;
    const emptyEl = document.getElementById('day-curve-empty') as HTMLElement;
    const closeBtn = document.getElementById('day-curve-close') as HTMLElement;

    if (this.openDate === date && !overlay.classList.contains('hidden')) {
      this.close();
      return;
    }

    titleEl.textContent = new Date(date + 'T12:00:00').toLocaleDateString([], { day: '2-digit', month: 'short' });
    overlay.classList.remove('hidden');
    this.openDate = date;

    if (this.chart) { this.chart.destroy(); this.chart = null; }

    const points = await window.claudeUsage.getDayTimeSeries(date);

    if (points.length < 2) {
      document.querySelector('.day-curve-chart-wrap')!.setAttribute('style', 'display:none');
      emptyEl.classList.remove('hidden');
    } else {
      document.querySelector('.day-curve-chart-wrap')!.setAttribute('style', '');
      emptyEl.classList.add('hidden');
      const labels = points.map(p => new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const canvas = document.getElementById('day-curve-canvas') as HTMLCanvasElement;
      this.chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: points.map(p => Math.min(p.session, 100)),
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76,175,80,0.15)',
            borderWidth: 1.5,
            pointRadius: 0,
            fill: true,
            tension: 0.3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: false },
            y: { display: false, min: 0, max: 100 },
          },
          animation: false,
        },
      });
    }

    closeBtn.onclick = () => this.close();
  }

  close(): void {
    const overlay = document.getElementById('day-curve-overlay');
    if (overlay) overlay.classList.add('hidden');
    if (this.chart) { this.chart.destroy(); this.chart = null; }
    this.openDate = null;
  }
}
