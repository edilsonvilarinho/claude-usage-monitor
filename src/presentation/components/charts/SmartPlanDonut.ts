import { Chart, DoughnutController, ArcElement, Tooltip } from 'chart.js';

Chart.register(DoughnutController, ArcElement, Tooltip);

export class SmartPlanDonut {
  private chart: Chart | null = null;

  render(canvasId: string, pct: number, colorHex: string): void {
    if (this.chart) { this.chart.destroy(); this.chart = null; }
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#444';
    this.chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [pct, Math.max(0, 100 - pct)],
          backgroundColor: [colorHex, borderColor],
          borderWidth: 0,
        }],
      },
      options: {
        cutout: '72%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: false,
      },
    });
  }

  destroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }
}
