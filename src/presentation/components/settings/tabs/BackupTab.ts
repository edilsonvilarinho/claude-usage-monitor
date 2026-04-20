import type { AppSettings } from '../../../../services/settingsService';
import { fitWindow } from '../../../layouts/PopupLayout';

export function bindBackupTab(s: AppSettings): void {
  if (s.autoBackupFolder) {
    const lbl = document.getElementById('lbl-auto-backup-folder');
    if (lbl) lbl.textContent = s.autoBackupFolder;
  }
}

export function setupBackupTabHandlers(): void {
  document.getElementById('btn-test-notif')?.addEventListener('click', () => void window.claudeUsage.testNotification());

  document.getElementById('btn-auto-backup-folder')?.addEventListener('click', async () => {
    const folder = await window.claudeUsage.chooseAutoBackupFolder();
    if (folder) {
      await window.claudeUsage.saveSettings({ autoBackupFolder: folder });
      const lbl = document.getElementById('lbl-auto-backup-folder');
      if (lbl) lbl.textContent = folder;
      fitWindow();
    }
  });
}

export function readBackupTab(): Pick<AppSettings, 'autoBackupMode'> {
  const val = (document.getElementById('setting-auto-backup-mode') as HTMLSelectElement)?.value;
  return {
    autoBackupMode: (val as AppSettings['autoBackupMode']) ?? 'never',
  };
}
