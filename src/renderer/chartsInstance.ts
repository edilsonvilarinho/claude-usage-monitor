import {
  Chart, DoughnutController, ArcElement, Tooltip,
  LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Legend,
} from 'chart.js';

Chart.register(DoughnutController, ArcElement, Tooltip, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Legend);

import { GaugeChart } from '../presentation/components/charts/GaugeChart';
import { TrayIcon } from '../presentation/components/charts/TrayIcon';
import { DailyChart } from '../presentation/components/charts/DailyChart';
import { BurnRate } from '../presentation/components/charts/BurnRate';
import { DayCurvePopup } from '../presentation/components/charts/DayCurvePopup';
import { SmartPlanDonut } from '../presentation/components/charts/SmartPlanDonut';

export const sessionGauge = new GaugeChart('gauge-session');
export const weeklyGauge = new GaugeChart('gauge-weekly');
export const costGauge = new GaugeChart('cost-gauge');
export const trayIcon = new TrayIcon();
export const dailyChart = new DailyChart();
export const burnRate = new BurnRate();
export const dayCurvePopup = new DayCurvePopup();
export const smartPlanDonut = new SmartPlanDonut();

export { Chart };