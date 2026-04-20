import { appStore } from '../stores/appStore';
import { tr } from '../layouts/i18n';

let registered = false;

export function useUsageData(): void {
  if (registered) return;
  registered = true;

  window.claudeUsage.onUsageUpdated((data) => {
    appStore.set('lastSessionPct', Math.round(data.five_hour.utilization));
    appStore.set('lastWeeklyPct', Math.round(data.seven_day.utilization));
    appStore.set('lastWeeklyResetsAt', data.seven_day.resets_at);
    appStore.set('lastUpdatedTime', new Date().toISOString());
  });
}
