import { appStore } from '../stores/appStore';

let registered = false;

export function usePolling(): void {
  if (registered) return;
  registered = true;

  window.claudeUsage.onNextPollAt((nextPollAt: number) => {
    appStore.set('autoRefreshIntervalMs', nextPollAt - Date.now());
  });

  window.claudeUsage.onRateLimited((until) => {
    appStore.set('isRateLimited', true);
  });
}
