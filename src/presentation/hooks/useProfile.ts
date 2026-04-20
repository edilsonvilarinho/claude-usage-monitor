import { appStore } from '../stores/appStore';

let registered = false;

export function useProfile(): void {
  if (registered) return;
  registered = true;

  window.claudeUsage.onProfileUpdated((profile) => {
    appStore.set('showAccountBar', true);
  });
}
