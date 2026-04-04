import { Notification, shell } from 'electron';
import { UsageData } from '../models/usageData';
import { getSettings } from './settingsService';
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
  return path.join(process.resourcesPath || __dirname, '..', 'assets', 'icon.ico');
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
  showToast(
    'Claude — Test Notification',
    'Notifications are working correctly',
    settings.notifications.soundEnabled
  );
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

  const sessionPct = Math.round(data.five_hour.utilization);
  const weeklyPct  = Math.round(data.seven_day.utilization);

  // Detect time-window reset (resets_at changed to a new value)
  if (prevSessionResetsAt !== null && isSignificantReset(prevSessionResetsAt, data.five_hour.resets_at, 60 * 60 * 1000)) {
    if (notifyOnWindowReset) {
      showToast('Claude — Session Window Reset', 'Your 5-hour usage window has reset', soundEnabled);
    }
    state.sessionNotified = false;
  }
  prevSessionResetsAt = data.five_hour.resets_at;

  if (prevWeeklyResetsAt !== null && isSignificantReset(prevWeeklyResetsAt, data.seven_day.resets_at, 24 * 60 * 60 * 1000)) {
    if (notifyOnWindowReset) {
      showToast('Claude — Weekly Window Reset', 'Your weekly usage window has reset', soundEnabled);
    }
    state.weeklyNotified = false;
  }
  prevWeeklyResetsAt = data.seven_day.resets_at;

  // Session: detect drop below resetThreshold after having been notified
  if (sessionPct < resetThreshold) {
    if (state.sessionNotified && notifyOnReset) {
      showToast(
        'Claude — Session Limit Freed',
        `Session usage dropped to ${sessionPct}% — limit has reset`,
        soundEnabled
      );
    }
    state.sessionNotified = false;
  }

  // Weekly: detect drop below resetThreshold after having been notified
  if (weeklyPct < resetThreshold) {
    if (state.weeklyNotified && notifyOnReset) {
      showToast(
        'Claude — Weekly Limit Freed',
        `Weekly usage dropped to ${weeklyPct}% — limit has reset`,
        soundEnabled
      );
    }
    state.weeklyNotified = false;
  }

  // Session threshold crossed (warn)
  if (!state.sessionNotified && sessionPct >= sessionThreshold) {
    showToast(
      'Claude — Session Limit Warning',
      `Session usage is at ${sessionPct}% (${sessionThreshold}% threshold reached)`,
      soundEnabled
    );
    state.sessionNotified = true;
  }

  // Weekly threshold crossed (warn)
  if (!state.weeklyNotified && weeklyPct >= weeklyThreshold) {
    showToast(
      'Claude — Weekly Limit Warning',
      `Weekly usage is at ${weeklyPct}% (${weeklyThreshold}% threshold reached)`,
      soundEnabled
    );
    state.weeklyNotified = true;
  }
}
