import type { Lang } from '../../renderer/app';

export function formatResetsIn(isoDate: string, lang: Lang, t: {
  resettingText: string;
  resetsIn: (d: number, h: number, m: number) => string;
}): string {
  const resetsAt = new Date(isoDate).getTime();
  const now = Date.now();
  const diffMs = resetsAt - now;

  if (diffMs <= 0) return t.resettingText;

  const totalMinutes = Math.floor(diffMs / 60000);
  const days    = Math.floor(totalMinutes / 1440);
  const hours   = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  return t.resetsIn(days, hours, minutes);
}

export function formatResetAt(isoDate: string, lang: Lang): string {
  const date = new Date(isoDate);
  const diffMs = date.getTime() - Date.now();
  const isMultiDay = diffMs > 24 * 60 * 60 * 1000;
  const locale = lang === 'pt-BR' ? 'pt-BR' : 'en';

  const timeStr = date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });

  const tzParts = Intl.DateTimeFormat(locale, { timeZoneName: 'short' }).formatToParts(date);
  const tz = tzParts.find((p) => p.type === 'timeZoneName')?.value ?? '';

  if (isMultiDay) {
    const dayStr = date.toLocaleDateString(locale, { weekday: 'short' });
    return tz ? `${dayStr} ${timeStr} • ${tz}` : `${dayStr} ${timeStr}`;
  }
  return tz ? `${timeStr} • ${tz}` : timeStr;
}

export { formatMinutes } from './formatMinutes';

export function formatRelativeTime(ts: number, t: {
  syncNever: string;
  syncJustNow: string;
  syncMinAgo: (mins: number) => string;
  syncHAgo: (hrs: number) => string;
  syncDAgo: (days: number) => string;
}): string {
  if (!ts) return t.syncNever;
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t.syncJustNow;
  if (mins < 60) return t.syncMinAgo(mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t.syncHAgo(hrs);
  return t.syncDAgo(Math.floor(hrs / 24));
}
