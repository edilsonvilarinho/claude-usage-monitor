import { syncStore } from '../stores/syncStore';

let registered = false;

export function useCloudSync(): void {
  if (registered) return;
  registered = true;

  syncStore.subscribe('syncLastKnownAt', (val) => console.log('[syncStore] syncLastKnownAt:', val));
  syncStore.subscribe('syncLastKnownStatus', (val) => console.log('[syncStore] syncLastKnownStatus:', val));
}
