import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
import { colorForPct } from '../../shared/colors';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

export class GaugeChart {
  private chart: Chart | null = null;
  private canvasId: string;

  constructor(canvasId: string) {
    this.canvasId = canvasId;
  }

  mount(): void {
    if (this.chart) {
      this.chart.destroy();
    }
    const canvas = document.getElementById(this.canvasId) as HTMLCanvasElement;
    this.chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [0, 100],
          backgroundColor: ['#22c55e', 'rgba(128,128,128,0.15)'],
          borderWidth: 0,
          borderRadius: 4,
        }],
      },
      options: {
        circumference: 180,
        rotation: -90,
        cutout: '72%',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: { tooltip: { enabled: false }, legend: { display: false } },
      },
    });
  }

  update(pct: number): void {
    if (!this.chart) {
      this.mount();
    }
    const filled = Math.max(0, Math.min(100, pct));
    this.chart!.data.datasets[0]!.data = [filled, 100 - filled];
    (this.chart!.data.datasets[0] as { backgroundColor: string[] }).backgroundColor =
      [colorForPct(pct), 'rgba(128,128,128,0.15)'];
    this.chart!.update('none');
  }

  resize(): void {
    this.chart?.resize();
  }

  destroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }
}
