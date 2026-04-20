import { createStore } from './store';

interface SyncState {
  syncLastKnownAt: number | null;
  syncLastKnownIntervalMs: number;
  syncLastKnownStatus: 'synced' | 'syncing' | 'error' | null;
  getSettings_cache: import('../globals').AppSettings | null;
}

export const syncStore = createStore<SyncState>({
  syncLastKnownAt: null,
  syncLastKnownIntervalMs: 15 * 60 * 1000,
  syncLastKnownStatus: null,
  getSettings_cache: null,
});
