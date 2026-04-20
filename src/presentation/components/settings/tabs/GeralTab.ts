import type { AppSettings } from '../../../../services/settingsService';

export function bindGeralTab(s: AppSettings): void {
  (document.getElementById('setting-startup') as HTMLInputElement).checked = s.launchAtStartup;
  (document.getElementById('setting-always-visible') as HTMLInputElement).checked = s.alwaysVisible;
}

export function readGeralTab(): Pick<AppSettings, 'launchAtStartup' | 'alwaysVisible'> {
  return {
    launchAtStartup: (document.getElementById('setting-startup') as HTMLInputElement).checked,
    alwaysVisible: (document.getElementById('setting-always-visible') as HTMLInputElement).checked,
  };
}
