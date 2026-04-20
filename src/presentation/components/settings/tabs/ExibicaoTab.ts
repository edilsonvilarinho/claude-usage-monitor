import type { AppSettings } from '../../../../services/settingsService';

export function bindExibicaoTab(s: AppSettings): void {
  (document.getElementById('setting-theme') as HTMLSelectElement).value = s.theme;
  (document.getElementById('setting-language') as HTMLSelectElement).value = s.language;
  (document.getElementById('setting-window-size') as HTMLSelectElement).value = s.windowSize;
  (document.getElementById('setting-auto-refresh') as HTMLInputElement).checked = s.autoRefresh;
  (document.getElementById('setting-auto-refresh-interval') as HTMLInputElement).value = String(s.autoRefreshInterval);
  (document.getElementById('setting-compact-mode') as HTMLInputElement).checked = s.compactMode;
  (document.getElementById('setting-show-account-bar') as HTMLInputElement).checked = s.showAccountBar;
  (document.getElementById('setting-show-daily-chart') as HTMLInputElement).checked = s.showDailyChart;
  (document.getElementById('setting-show-extra-bars') as HTMLInputElement).checked = s.showExtraBars;
  (document.getElementById('setting-show-footer') as HTMLInputElement).checked = s.showFooter;
}

export function readExibicaoTab(): Pick<AppSettings, 'theme' | 'language' | 'windowSize' | 'autoRefresh' | 'autoRefreshInterval' | 'compactMode' | 'showAccountBar' | 'showDailyChart' | 'showExtraBars' | 'showFooter'> {
  return {
    theme: (document.getElementById('setting-theme') as HTMLSelectElement).value as AppSettings['theme'],
    language: (document.getElementById('setting-language') as HTMLSelectElement).value as AppSettings['language'],
    windowSize: (document.getElementById('setting-window-size') as HTMLSelectElement).value as AppSettings['windowSize'],
    autoRefresh: (document.getElementById('setting-auto-refresh') as HTMLInputElement).checked,
    autoRefreshInterval: parseInt((document.getElementById('setting-auto-refresh-interval') as HTMLInputElement).value, 10) || 300,
    compactMode: (document.getElementById('setting-compact-mode') as HTMLInputElement).checked,
    showAccountBar: (document.getElementById('setting-show-account-bar') as HTMLInputElement).checked,
    showDailyChart: (document.getElementById('setting-show-daily-chart') as HTMLInputElement).checked,
    showExtraBars: (document.getElementById('setting-show-extra-bars') as HTMLInputElement).checked,
    showFooter: (document.getElementById('setting-show-footer') as HTMLInputElement).checked,
  };
}
