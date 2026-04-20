import { appStore } from '../stores/appStore';

let registered = false;

export function useSmartStatus(): void {
  if (registered) return;
  registered = true;

  window.claudeUsage.onSmartStatusUpdated((status) => {
    appStore.set('currentSmartStatus', status);
  });
}
