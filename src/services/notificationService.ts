import { Notification, shell } from 'electron';
import { UsageData } from '../models/usageData';
import { getSettings } from './settingsService';
import { getMainTranslations } from '../i18n/mainTranslations';
import * as path from 'path';

interface NotificationState {
  sessionNotified: boolean;
  weeklyNotified: boolean;
}

const state: NotificationState = {
  sessionNotified: false,
  weeklyNotified: false,
};

// Track previous resets_at to detect when a time window rolls over
let prevSessionResetsAt: string | null = null;
let prevWeeklyResetsAt: string | null = null;

function getIconPath(): string {
  const iconFile = process.platform === 'linux' ? 'tray-icon.png' : 'icon.ico';
  return path.join(process.resourcesPath || __dirname, '..', 'assets', iconFile);
}

function showToast(title: string, body: string, sound: boolean): void {
  if (!Notification.isSupported()) return;
  if (sound) shell.beep();
  new Notification({ title, body, icon: getIconPath(), silent: !sound }).show();
}

export function syncWindowState(data: UsageData): void {
  prevSessionResetsAt = data.five_hour.resets_at;
  prevWeeklyResetsAt  = data.seven_day.resets_at;
}

export function sendTestNotification(): void {
  const settings = getSettings();
  const t = getMainTranslations(settings.language);
  showToast(t.notifTestTitle, t.notifTestBody, settings.notifications.soundEnabled);
}

function isSignificantReset(prevAt: string, newAt: string, minGapMs: number): boolean {
  const prev = new Date(prevAt).getTime();
  const next = new Date(newAt).getTime();
  return !isNaN(prev) && !isNaN(next) && (next - prev) > minGapMs;
}

export function checkAndNotify(data: UsageData): void {
  const settings = getSettings();
  if (!settings.notifications.enabled) return;

  const {
    sessionThreshold, weeklyThreshold,
    resetThreshold, notifyOnReset,
    notifyOnWindowReset, soundEnabled,
  } = settings.notifications;

  const t = getMainTranslations(settings.language);
  const sessionPct = Math.round(data.five_hour.utilization);
  const weeklyPct  = Math.round(data.seven_day.utilization);

  // Detect time-window reset (resets_at changed to a new value)
  if (prevSessionResetsAt !== null && isSignificantReset(prevSessionResetsAt, data.five_hour.resets_at, 60 * 60 * 1000)) {
    if (notifyOnWindowReset) {
      showToast(t.notifSessionWindowResetTitle, t.notifSessionWindowResetBody, soundEnabled);
    }
    state.sessionNotified = false;
  }
  prevSessionResetsAt = data.five_hour.resets_at;

  if (prevWeeklyResetsAt !== null && isSignificantReset(prevWeeklyResetsAt, data.seven_day.resets_at, 24 * 60 * 60 * 1000)) {
    if (notifyOnWindowReset) {
      showToast(t.notifWeeklyWindowResetTitle, t.notifWeeklyWindowResetBody, soundEnabled);
    }
    state.weeklyNotified = false;
  }
  prevWeeklyResetsAt = data.seven_day.resets_at;

  // Session: detect drop below resetThreshold after having been notified
  if (sessionPct < resetThreshold) {
    if (state.sessionNotified && notifyOnReset) {
      showToast(t.notifSessionFreedTitle, t.notifSessionFreedBody(sessionPct), soundEnabled);
    }
    state.sessionNotified = false;
  }

  // Weekly: detect drop below resetThreshold after having been notified
  if (weeklyPct < resetThreshold) {
    if (state.weeklyNotified && notifyOnReset) {
      showToast(t.notifWeeklyFreedTitle, t.notifWeeklyFreedBody(weeklyPct), soundEnabled);
    }
    state.weeklyNotified = false;
  }

  // Session threshold crossed (warn)
  if (!state.sessionNotified && sessionPct >= sessionThreshold) {
    showToast(t.notifSessionWarnTitle, t.notifSessionWarnBody(sessionPct, sessionThreshold), soundEnabled);
    state.sessionNotified = true;
  }

  // Weekly threshold crossed (warn)
  if (!state.weeklyNotified && weeklyPct >= weeklyThreshold) {
    showToast(t.notifWeeklyWarnTitle, t.notifWeeklyWarnBody(weeklyPct, weeklyThreshold), soundEnabled);
    state.weeklyNotified = true;
  }
}
