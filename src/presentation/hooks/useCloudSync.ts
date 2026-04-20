import { syncStore } from '../stores/syncStore';

let registered = false;

export function useCloudSync(): void {
  if (registered) return;
  registered = true;

  window.claudeUsage.onCloudSyncStatusChanged((status) => {
    syncStore.set('syncLastKnownStatus', status.enabled ? 'synced' : null);
    syncStore.set('syncLastKnownAt', status.lastSyncAt);
  });
}
