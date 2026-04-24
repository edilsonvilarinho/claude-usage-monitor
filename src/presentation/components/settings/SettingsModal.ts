import type { AppSettings } from '../../../services/settingsService';
import { fitWindow } from '../../layouts/PopupLayout';
import { bindGeralTab, readGeralTab } from './tabs/GeralTab';
import { bindExibicaoTab, readExibicaoTab } from './tabs/ExibicaoTab';
import { bindNotifTab, readNotifTab, setupNotifTabInputHandlers } from './tabs/NotifTab';
import { bindBackupTab, readBackupTab, setupBackupTabHandlers } from './tabs/BackupTab';
import { bindSmartPlanTab, readSmartPlanTab } from './tabs/SmartPlanTab';

const CHANGE_IDS = [
  'setting-startup', 'setting-always-visible',
  'setting-notif-enabled', 'setting-sound-enabled',
  'setting-notify-on-window-reset', 'setting-notify-on-reset',
  'setting-reset-threshold', 'setting-theme', 'setting-language',
  'setting-window-size', 'setting-auto-refresh',
  'setting-auto-refresh-interval', 'setting-session-threshold',
  'setting-weekly-threshold', 'setting-auto-backup-mode',
  'setting-show-daily-chart', 'setting-show-extra-bars',
  'setting-show-footer', 'setting-show-account-bar',
  'setting-show-in-taskbar', 'setting-compact-mode',
  'sp-enabled', 'sp-day-0', 'sp-day-1', 'sp-day-2', 'sp-day-3',
  'sp-day-4', 'sp-day-5', 'sp-day-6',
  'sp-work-start', 'sp-work-end', 'sp-break-start', 'sp-break-end',
];

export function setupSettingsModal(
  onSave: () => void,
  loadCloudSync: () => void,
): void {
  document.getElementById('btn-settings')?.addEventListener('click', async () => {
    document.getElementById('settings-modal')?.classList.remove('hidden');
    const settings = await window.claudeUsage.getSettings();
    loadSettingsToModal(settings);
    loadCloudSync();
  });
  document.getElementById('btn-settings-close')?.addEventListener('click', () => {
    document.getElementById('settings-modal')?.classList.add('hidden');
  });
  document.getElementById('settings-modal')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.modal-overlay') === document.getElementById('settings-modal')) {
      document.getElementById('settings-modal')?.classList.add('hidden');
    }
  });

  for (const id of CHANGE_IDS) {
    document.getElementById(id)?.addEventListener('change', onSave);
  }

  setupNotifTabInputHandlers();
  setupBackupTabHandlers();
}

export function loadSettingsToModal(settings: AppSettings): void {
  bindGeralTab(settings);
  bindExibicaoTab(settings);
  bindNotifTab(settings);
  bindBackupTab(settings);
  bindSmartPlanTab(settings);
}

export function readSettingsFromModal(): Partial<AppSettings> {
  return {
    ...readGeralTab(),
    ...readExibicaoTab(),
    ...readNotifTab(),
    ...readBackupTab(),
    ...readSmartPlanTab(),
  };
}
