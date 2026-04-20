import { GaugeChart } from './components/charts/GaugeChart';
import { TrayIcon } from './components/charts/TrayIcon';
import { DailyChart } from './components/charts/DailyChart';
import { BurnRate } from './components/charts/BurnRate';
import { DayCurvePopup } from './components/charts/DayCurvePopup';
import { SmartPlanDonut } from './components/charts/SmartPlanDonut';
import { useUsageData } from './hooks/useUsageData';
import { useSmartStatus } from './hooks/useSmartStatus';
import { useProfile } from './hooks/useProfile';
import { usePolling } from './hooks/usePolling';
import { useUpdateNotifier } from './hooks/useUpdateNotifier';
import { useCredentials } from './hooks/useCredentials';
import { useCloudSync } from './hooks/useCloudSync';
import { useSettings } from './hooks/useSettings';

export function bootstrap(): void {
  const sessionGauge = new GaugeChart('gauge-session');
  const weeklyGauge = new GaugeChart('gauge-weekly');
  const trayIcon = new TrayIcon();
  const dailyChart = new DailyChart();
  const burnRate = new BurnRate();
  const dayCurvePopup = new DayCurvePopup();
  const smartPlanDonut = new SmartPlanDonut();

  useUsageData();
  useSmartStatus();
  useProfile();
  usePolling();
  useUpdateNotifier();
  useCredentials();
  useCloudSync();

  const { loadSettings } = useSettings();
  void loadSettings();
}

export { sessionGauge, weeklyGauge, trayIcon, dailyChart, burnRate, dayCurvePopup, smartPlanDonut };
