import type { AppSettings, NotificationSettings } from '../../../../services/settingsService';

export function bindNotifTab(s: AppSettings): void {
  const n = s.notifications;
  (document.getElementById('setting-notif-enabled') as HTMLInputElement).checked = n.enabled;
  (document.getElementById('setting-sound-enabled') as HTMLInputElement).checked = n.soundEnabled;
  (document.getElementById('setting-notify-on-window-reset') as HTMLInputElement).checked = n.notifyOnWindowReset;
  (document.getElementById('setting-notify-on-reset') as HTMLInputElement).checked = n.notifyOnReset;
  (document.getElementById('setting-reset-threshold') as HTMLInputElement).value = String(n.resetThreshold);
  (document.getElementById('setting-session-threshold') as HTMLInputElement).value = String(n.sessionThreshold);
  (document.getElementById('setting-weekly-threshold') as HTMLInputElement).value = String(n.weeklyThreshold);
  document.getElementById('lbl-reset-threshold')!.textContent = `${n.resetThreshold}%`;
  document.getElementById('lbl-session-threshold')!.textContent = `${n.sessionThreshold}%`;
  document.getElementById('lbl-weekly-threshold')!.textContent = `${n.weeklyThreshold}%`;
}

export function setupNotifTabInputHandlers(): void {
  document.getElementById('setting-session-threshold')?.addEventListener('input', (e) => {
    const lbl = document.getElementById('lbl-session-threshold');
    if (lbl) lbl.textContent = `${(e.target as HTMLInputElement).value}%`;
  });
  document.getElementById('setting-weekly-threshold')?.addEventListener('input', (e) => {
    const lbl = document.getElementById('lbl-weekly-threshold');
    if (lbl) lbl.textContent = `${(e.target as HTMLInputElement).value}%`;
  });
  document.getElementById('setting-reset-threshold')?.addEventListener('input', (e) => {
    const lbl = document.getElementById('lbl-reset-threshold');
    if (lbl) lbl.textContent = `${(e.target as HTMLInputElement).value}%`;
  });
}

export function readNotifTab(): { notifications: NotificationSettings } {
  return {
    notifications: {
      enabled: (document.getElementById('setting-notif-enabled') as HTMLInputElement).checked,
      soundEnabled: (document.getElementById('setting-sound-enabled') as HTMLInputElement).checked,
      notifyOnWindowReset: (document.getElementById('setting-notify-on-window-reset') as HTMLInputElement).checked,
      notifyOnReset: (document.getElementById('setting-notify-on-reset') as HTMLInputElement).checked,
      resetThreshold: parseInt((document.getElementById('setting-reset-threshold') as HTMLInputElement).value, 10) || 50,
      sessionThreshold: parseInt((document.getElementById('setting-session-threshold') as HTMLInputElement).value, 10) || 80,
      weeklyThreshold: parseInt((document.getElementById('setting-weekly-threshold') as HTMLInputElement).value, 10) || 80,
    },
  };
}
