import { appStore } from '../stores/appStore';

let registered = false;

export function useUpdateNotifier(): void {
  if (registered) return;
  registered = true;

  window.claudeUsage.onUpdateAvailable(({ version, url, downloadUrl, isMajor }) => {
    console.log('[useUpdateNotifier] Update available:', version, isMajor);
  });

  window.claudeUsage.onUpdateDownloadProgress((pct) => {
    console.log('[useUpdateNotifier] Download progress:', pct);
  });
}
