import { tr } from '../layouts/i18n';

let autoRefreshEnabled = false;
let nextPollTimer: ReturnType<typeof setInterval> | null = null;
let nextPollAt = 0;

export function isAutoRefreshEnabled(): boolean {
  return autoRefreshEnabled;
}

export function applyAutoRefresh(enabled: boolean, intervalSeconds: number): void {
  autoRefreshEnabled = enabled;
  if (enabled) {
    const ms = Math.max(60, intervalSeconds) * 1000;
    void window.claudeUsage.setPollInterval(ms);
  } else {
    stopNextPollCountdown();
    void window.claudeUsage.setPollInterval(null);
  }
  const intervalRow = document.getElementById('row-auto-refresh-interval') as HTMLElement;
  if (intervalRow) intervalRow.style.opacity = enabled ? '1' : '0.4';
}

export function startNextPollCountdown(intervalMs: number): void {
  stopNextPollCountdown();
  nextPollAt = Date.now() + intervalMs;
  const el = document.getElementById('next-poll-text') as HTMLElement;
  if (!el) return;

  function tick(): void {
    const remaining = nextPollAt - Date.now();
    if (remaining <= 0) { el.textContent = ''; return; }
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    el.textContent = tr().nextPollIn(`${m}:${String(s).padStart(2, '0')}`);
  }

  tick();
  nextPollTimer = setInterval(tick, 1000);
}

export function stopNextPollCountdown(): void {
  if (nextPollTimer) { clearInterval(nextPollTimer); nextPollTimer = null; }
  const el = document.getElementById('next-poll-text') as HTMLElement;
  if (el) el.textContent = '';
}
