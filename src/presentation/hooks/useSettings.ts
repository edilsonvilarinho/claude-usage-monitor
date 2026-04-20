import { syncStore } from '../stores/syncStore';

let settingsCache: any = null;
let registered = false;

export function useSettings(): {
  loadSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<void>;
  getCached: () => any;
} {
  if (registered) return { loadSettings, saveSettings, getCached };

  async function loadSettings() {
    const s = await window.claudeUsage.getSettings();
    settingsCache = s;
    syncStore.set('getSettings_cache', s);
    return s;
  }

  async function saveSettings(settings: any) {
    await window.claudeUsage.saveSettings(settings);
    settingsCache = settings;
    syncStore.set('getSettings_cache', settings);
  }

  function getCached() {
    return settingsCache;
  }

  return { loadSettings, saveSettings, getCached };
}
