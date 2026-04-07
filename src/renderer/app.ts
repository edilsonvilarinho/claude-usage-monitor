import { Chart, DoughnutController, ArcElement, Tooltip } from 'chart.js';

Chart.register(DoughnutController, ArcElement, Tooltip);

// ── Types ─────────────────────────────────────────────────────────────────────
interface DailySnapshot { date: string; maxWeekly: number; maxSession: number; maxCredits?: number; sessionResets?: number; sessionAccum?: number }

interface UsageWindow {
  utilization: number;
  resets_at: string;
}

interface UsageData {
  five_hour: UsageWindow;
  seven_day: UsageWindow;
  seven_day_sonnet?: UsageWindow;
  extra_usage?: { is_enabled: boolean; monthly_limit: number; used_credits: number };
}

interface ProfileData {
  account: {
    display_name: string;
    email: string;
    has_claude_pro: boolean;
    has_claude_max: boolean;
  };
}

interface AppSettings {
  launchAtStartup: boolean;
  alwaysVisible: boolean;
  notifications: {
    enabled: boolean;
    sessionThreshold: number;
    weeklyThreshold: number;
    resetThreshold: number;
    notifyOnReset: boolean;
    notifyOnWindowReset: boolean;
    soundEnabled: boolean;
  };
  theme: 'system' | 'dark' | 'light';
  language: 'en' | 'pt-BR';
  pollIntervalMinutes: number;
  windowSize: 'normal' | 'medium' | 'large' | 'xlarge';
  autoRefresh: boolean;
  autoRefreshInterval: number;
  showHistory: boolean;
}

declare global {
  interface Window {
    claudeUsage: {
      onUsageUpdated: (cb: (data: UsageData) => void) => void;
      onError: (cb: (msg: string) => void) => void;
      onRateLimited: (cb: (until: number, resetAt?: number) => void) => void;
      onNextPollAt: (cb: (nextPollAt: number) => void) => void;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (s: Partial<AppSettings>) => Promise<void>;
      setStartup: (v: boolean) => Promise<void>;
      refreshNow: () => Promise<void>;
      forceRefreshNow: () => Promise<void>;
      testNotification: () => Promise<void>;
      sendTrayIcon: (dataUrl: string) => void;
      closeWindow: () => void;
      setWindowHeight: (h: number) => void;
      onUpdateAvailable: (cb: (info: { version: string; url: string }) => void) => void;
      openReleaseUrl: (url: string) => void;
      onCredentialMissing: (cb: (credPath: string) => void) => void;
      getAppVersion: () => Promise<string>;
      getProfile: () => Promise<ProfileData | null>;
      setPollInterval: (ms: number | null) => Promise<void>;
      getDailyHistory: () => Promise<DailySnapshot[]>;
      clearDailyHistory: () => Promise<void>;
    };
  }
}

// ── i18n ──────────────────────────────────────────────────────────────────────

type Lang = 'en' | 'pt-BR';

const translations = {
  en: {
    sessionLabel:     'Session (5h)',
    weeklyLabel:      'Weekly (7d)',
    sonnetLabel:      'Sonnet',
    creditsLabel:     'Credits',
    loadingText:      'Loading...',
    refreshText:      '↺ Refresh',
    resettingText:    'Resetting...',
    refreshingText:   'Refreshing...',
    errorPrefix:      'Error: ',
    generalTitle:     'General',
    notifTitle:       'Notifications',
    launchAtStartup:  'Launch at startup',
    alwaysVisible:    'Always visible',
    themeLabel:       'Theme',
    themeSystem:      'System',
    themeDark:        'Dark',
    themeLight:       'Light',
    languageLabel:    'Language',
    langEn:           'English',
    langPtBR:         'Português (BR)',
    sizeLabel:                 'Size',
    sizeNormal:                'Normal',
    sizeMedium:                'Medium',
    sizeLarge:                 'Large',
    sizeXLarge:                'Very Large',
    autoRefreshLabel:          'Auto refresh',
    autoRefreshIntervalLabel:  'Interval (s)',
    autoRefreshHint:           'Min 60s — recommended: 300s',
    enable:              'Enable',
    sound:               'Sound',
    notifyOnReset:       'Notify when usage resets to 0%',
    notifyOnDropLabel:   'Notify when usage drops',
    resetThresholdLabel: 'Reset threshold (%)',
    sessionThreshold:    'Session limit',
    weeklyThreshold:     'Weekly limit',
    test:                'Test',
    rateLimitMsg:    'Rate limited',
    rateLimitRetry:  (t: string) => `Retry in ${t}`,
    rateLimitAt:     (time: string) => `(at ${time})`,
    rateLimitNow:    'Retrying...',
    updatedAt:  (time: string) => `Updated: ${time}`,
    failedAt:   (time: string) => `Failed: ${time}`,
    resetsIn:   (d: number, h: number, m: number) =>
      d > 0 ? `Resets in ${d}d ${h}h` : h > 0 ? `Resets in ${h}h ${m}m` : `Resets in ${m}m`,
    resetsAt:   (timeStr: string) => `at ${timeStr}`,
    nextPollIn: (t: string) => `Next update in ${t}`,
    historyLabel: 'Usage history (24h)',
    dailyHistoryLabel: 'Weekly cycle',
    clearHistoryBtn: 'Clear',
    clearHistoryConfirm: 'Clear usage history?',
    tooltipSession: 'Session',
    tooltipWeekly: 'Weekly',
    tooltipCredits: 'Credits',
    tooltipResets: (n: number) => `${n} resets`,
    tooltipAccum: (n: number) => `${n}% accumulated`,
  },
  'pt-BR': {
    sessionLabel:     'Sessão (5h)',
    weeklyLabel:      'Semanal (7d)',
    sonnetLabel:      'Sonnet',
    creditsLabel:     'Créditos',
    loadingText:      'Carregando...',
    refreshText:      '↺ Atualizar',
    resettingText:    'Reiniciando...',
    refreshingText:   'Atualizando...',
    errorPrefix:      'Erro: ',
    generalTitle:     'Geral',
    notifTitle:       'Notificações',
    launchAtStartup:  'Iniciar com o sistema',
    alwaysVisible:    'Sempre visível',
    themeLabel:       'Tema',
    themeSystem:      'Sistema',
    themeDark:        'Escuro',
    themeLight:       'Claro',
    languageLabel:    'Idioma',
    langEn:           'English',
    langPtBR:         'Português (BR)',
    sizeLabel:                 'Tamanho',
    sizeNormal:                'Normal',
    sizeMedium:                'Médio',
    sizeLarge:                 'Grande',
    sizeXLarge:                'Muito Grande',
    autoRefreshLabel:          'Atualizar automaticamente',
    autoRefreshIntervalLabel:  'Intervalo (s)',
    autoRefreshHint:           'Mín 60s — recomendado: 300s',
    enable:              'Ativar',
    sound:               'Som',
    notifyOnReset:       'Avisar quando uso zerar',
    notifyOnDropLabel:   'Avisar quando uso cair',
    resetThresholdLabel: 'Limiar de reset (%)',
    sessionThreshold:    'Limite da sessão',
    weeklyThreshold:     'Limite semanal',
    test:                'Testar',
    rateLimitMsg:    'Limite de requisições',
    rateLimitRetry:  (t: string) => `Tentando novamente em ${t}`,
    rateLimitAt:     (time: string) => `(às ${time})`,
    rateLimitNow:    'Tentando novamente...',
    updatedAt:  (time: string) => `Atualizado: ${time}`,
    failedAt:   (time: string) => `Falhou: ${time}`,
    resetsIn:   (d: number, h: number, m: number) =>
      d > 0 ? `Reinicia em ${d}d ${h}h` : h > 0 ? `Reinicia em ${h}h ${m}m` : `Reinicia em ${m}m`,
    resetsAt:   (timeStr: string) => `às ${timeStr}`,
    nextPollIn: (t: string) => `Próxima atualização em ${t}`,
    historyLabel: 'Histórico de uso (24h)',
    dailyHistoryLabel: 'Ciclo semanal',
    clearHistoryBtn: 'Limpar',
    clearHistoryConfirm: 'Limpar histórico de uso?',
    tooltipSession: 'Sessão',
    tooltipWeekly: 'Semanal',
    tooltipCredits: 'Créditos',
    tooltipResets: (n: number) => `${n} resets`,
    tooltipAccum: (n: number) => `${n}% acumulado`,
  },
} as const;

type Translations = typeof translations.en;

let currentLang: Lang = 'en';

function tr(): Translations {
  return translations[currentLang];
}

function applyTranslations(): void {
  const t = tr();

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n as keyof Translations;
    const val = t[key];
    if (typeof val === 'string') {
      el.textContent = val;
    }
  });

  const themeSelect = document.getElementById('setting-theme') as HTMLSelectElement | null;
  if (themeSelect) {
    themeSelect.options[0].text = t.themeSystem;
    themeSelect.options[1].text = t.themeDark;
    themeSelect.options[2].text = t.themeLight;
  }

  const langSelect = document.getElementById('setting-language') as HTMLSelectElement | null;
  if (langSelect) {
    langSelect.options[0].text = t.langEn;
    langSelect.options[1].text = t.langPtBR;
  }

  const sizeSelect = document.getElementById('setting-window-size') as HTMLSelectElement | null;
  if (sizeSelect) {
    sizeSelect.options[0].text = t.sizeNormal;
    sizeSelect.options[1].text = t.sizeMedium;
    sizeSelect.options[2].text = t.sizeLarge;
    sizeSelect.options[3].text = t.sizeXLarge;
  }
}

// ── Window resize ─────────────────────────────────────────────────────────────

function fitWindow(): void {
  requestAnimationFrame(() => {
    const header     = document.querySelector('.header') as HTMLElement;
    const accountBar = document.getElementById('account-bar') as HTMLElement;
    const content    = document.querySelector('.content') as HTMLElement;
    const accountBarH = (accountBar?.style.display !== 'none' ? accountBar?.offsetHeight : 0) ?? 0;
    const h = header.offsetHeight + accountBarH + content.scrollHeight + 8;
    window.claudeUsage.setWindowHeight(h);
  });
}

// ── Size ──────────────────────────────────────────────────────────────────────

function applySize(size: AppSettings['windowSize']): void {
  document.body.dataset.size = size;
  // Give the DOM a frame to update CSS vars, then resize charts + window
  requestAnimationFrame(() => {
    sessionChart?.resize();
    weeklyChart?.resize();
    fitWindow();
  });
}

// ── Auto-refresh ──────────────────────────────────────────────────────────────

let currentAutoRefreshIntervalMs = 300 * 1000;
let autoRefreshEnabled = false;

function applyAutoRefresh(enabled: boolean, intervalSeconds: number): void {
  autoRefreshEnabled = enabled;
  if (enabled) {
    const ms = Math.max(60, intervalSeconds) * 1000;
    currentAutoRefreshIntervalMs = ms;
    void window.claudeUsage.setPollInterval(ms);
  } else {
    stopNextPollCountdown();
    void window.claudeUsage.setPollInterval(null);
  }
  const intervalRow = document.getElementById('row-auto-refresh-interval') as HTMLElement;
  intervalRow.style.opacity = enabled ? '1' : '0.4';
}

// ── Next poll countdown ───────────────────────────────────────────────────────

let nextPollTimer: ReturnType<typeof setInterval> | null = null;
let nextPollAt = 0;

function startNextPollCountdown(intervalMs: number): void {
  stopNextPollCountdown();
  nextPollAt = Date.now() + intervalMs;
  const el = document.getElementById('next-poll-text') as HTMLElement;
  if (!el) return;

  function tick(): void {
    const remaining = nextPollAt - Date.now();
    if (remaining <= 0) {
      el.textContent = '';
      return;
    }
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    el.textContent = tr().nextPollIn(`${m}:${String(s).padStart(2, '0')}`);
  }

  tick();
  nextPollTimer = setInterval(tick, 1000);
}

function stopNextPollCountdown(): void {
  if (nextPollTimer) { clearInterval(nextPollTimer); nextPollTimer = null; }
  const el = document.getElementById('next-poll-text') as HTMLElement;
  if (el) el.textContent = '';
}

// ── Rate limit countdown ──────────────────────────────────────────────────────

let countdownTimer: ReturnType<typeof setInterval> | null = null;
let isRateLimited = false;

function startRateLimitCountdown(until: number, resetAt?: number): void {
  stopNextPollCountdown();
  if (countdownTimer) clearInterval(countdownTimer);

  const banner = document.getElementById('rate-limit-banner') as HTMLElement;
  const label  = document.getElementById('rl-label') as HTMLElement;
  const timer  = document.getElementById('rl-timer') as HTMLElement;
  document.getElementById('error-banner')!.classList.remove('visible');
  banner.classList.add('visible');

  const clockTime = resetAt
    ? new Date(resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  function tick(): void {
    const remaining = until - Date.now();
    if (remaining <= 0) {
      timer.textContent = tr().rateLimitNow;
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
      isRateLimited = false;
      return;
    }
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    label.textContent = tr().rateLimitMsg;
    const countdown = tr().rateLimitRetry(`${m}:${String(s).padStart(2, '0')}`);
    timer.textContent = clockTime ? `${countdown} ${tr().rateLimitAt(clockTime)}` : countdown;
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

function clearRateLimitBanner(): void {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  document.getElementById('rate-limit-banner')!.classList.remove('visible');
}

// ── Gauge factory ─────────────────────────────────────────────────────────────

function colorForPct(pct: number): string {
  if (pct >= 80) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#22c55e';
}

function createGauge(canvasId: string): Chart {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [0, 100],
        backgroundColor: ['#22c55e', 'rgba(128,128,128,0.15)'],
        borderWidth: 0,
        borderRadius: 4,
      }],
    },
    options: {
      circumference: 180,
      rotation: -90,
      cutout: '72%',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: { tooltip: { enabled: false }, legend: { display: false } },
    },
  });
}

function updateGauge(chart: Chart, pct: number): void {
  const filled = Math.max(0, Math.min(100, pct));
  chart.data.datasets[0]!.data = [filled, 100 - filled];
  (chart.data.datasets[0] as { backgroundColor: string[] }).backgroundColor =
    [colorForPct(pct), 'rgba(128,128,128,0.15)'];
  chart.update('none');
}

// ── Tray icon (canvas rendering) ─────────────────────────────────────────────

function updateTrayIcon(sessionPct: number, weeklyPct: number): void {
  const canvas = document.getElementById('tray-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = 32;
  ctx.clearRect(0, 0, size, size);

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const bgColor = isDark ? 'rgba(30, 30, 30, 0.85)' : 'rgba(230, 230, 230, 0.92)';
  const textColor = isDark ? '#ffffff' : '#111111';

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();

  const maxPct = Math.max(sessionPct, weeklyPct);
  const color = colorForPct(maxPct);
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (maxPct / 100) * Math.PI * 2;

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 3, startAngle, endAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = textColor;
  const label = maxPct > 100 ? '!!!' : `${maxPct}`;
  ctx.font = `bold ${maxPct > 99 ? 7 : 9}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, size / 2, size / 2);

  lastRenderedData = { session: sessionPct, weekly: weeklyPct };

  canvas.toBlob((blob) => {
    if (!blob) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      window.claudeUsage.sendTrayIcon(reader.result as string);
    };
    reader.readAsDataURL(blob);
  }, 'image/png');
}

// ── Time formatting ───────────────────────────────────────────────────────────

function formatResetsIn(isoDate: string): string {
  const resetsAt = new Date(isoDate).getTime();
  const now = Date.now();
  const diffMs = resetsAt - now;

  if (diffMs <= 0) return tr().resettingText;

  const totalMinutes = Math.floor(diffMs / 60000);
  const days    = Math.floor(totalMinutes / 1440);
  const hours   = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  return tr().resetsIn(days, hours, minutes);
}

function formatResetAt(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = date.getTime() - Date.now();
  const isMultiDay = diffMs > 24 * 60 * 60 * 1000;
  const locale = currentLang === 'pt-BR' ? 'pt-BR' : 'en';

  const timeStr = date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });

  const tzParts = Intl.DateTimeFormat(locale, { timeZoneName: 'short' }).formatToParts(date);
  const tz = tzParts.find((p) => p.type === 'timeZoneName')?.value ?? '';

  if (isMultiDay) {
    const dayStr = date.toLocaleDateString(locale, { weekday: 'short' });
    return tz ? `${dayStr} ${timeStr} • ${tz}` : `${dayStr} ${timeStr}`;
  }
  return tz ? `${timeStr} • ${tz}` : timeStr;
}

function barClass(pct: number): string {
  if (pct >= 80) return 'crit';
  if (pct >= 60) return 'warn';
  return '';
}

// ── UI update ─────────────────────────────────────────────────────────────────

let sessionChart: Chart | null = null;
let weeklyChart:  Chart | null = null;
let lastRenderedData: { session: number; weekly: number } | null = null;

// ── Daily cycle chart ─────────────────────────────────────────────────────────

let lastWeeklyResetsAt: string | null = null;

function renderDailyChart(dailyData: DailySnapshot[], weeklyResetsAt: string): void {
  const container = document.getElementById('daily-chart');
  if (!container) return;

  const resetDate = new Date(weeklyResetsAt);
  const cycleStartMs = resetDate.getTime() - 7 * 24 * 60 * 60 * 1000;

  // Detectar se créditos existem em algum dia do histórico
  const hasCredits = dailyData.some(d => d.maxCredits !== undefined);

  // Legenda dinâmica
  const legendEl = document.getElementById('daily-legend');
  if (legendEl) {
    const t = tr();
    legendEl.innerHTML = [
      `<span class="legend-dot session"></span><span class="legend-text">${t.sessionLabel}</span>`,
      `<span class="legend-dot weekly"></span><span class="legend-text">${t.weeklyLabel}</span>`,
      ...(hasCredits ? [`<span class="legend-dot credits"></span><span class="legend-text">${t.creditsLabel}</span>`] : []),
    ].join('');
  }

  // Build 7 day slots
  const slots: {
    date: string; label: string; isToday: boolean; isFuture: boolean;
    weeklyPct: number | null; sessionPct: number | null; creditsPct: number | null;
    sessionResets: number; sessionAccum: number;
  }[] = [];
  const now = new Date();
  const todayStr = now.toLocaleDateString('sv');
  const locale = currentLang === 'pt-BR' ? 'pt-BR' : 'en';

  for (let i = 0; i < 7; i++) {
    const d = new Date(cycleStartMs + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toLocaleDateString('sv');
    const label = d.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '');
    const isFuture = dateStr > todayStr;
    const isToday  = dateStr === todayStr;
    const found = dailyData.find(s => s.date === dateStr);
    slots.push({
      date: dateStr, label, isToday, isFuture,
      weeklyPct:    found ? Math.min(found.maxWeekly, 100) : null,
      sessionPct:   found ? Math.min(found.maxSession ?? 0, 100) : null,
      creditsPct:   (found && found.maxCredits !== undefined) ? Math.min(found.maxCredits, 100) : null,
      sessionResets: found?.sessionResets ?? 1,
      sessionAccum:  found?.sessionAccum  ?? 0,
    });
  }

  const t   = tr();
  const BAR_MAX_PX = 40;
  container.innerHTML = slots.map(s => {
    const wPx = s.weeklyPct  !== null ? Math.max(3, Math.round((s.weeklyPct  / 100) * BAR_MAX_PX)) : 0;
    const sPx = s.sessionPct !== null ? Math.max(3, Math.round((s.sessionPct / 100) * BAR_MAX_PX)) : 0;
    const cPx = s.creditsPct !== null ? Math.max(3, Math.round((s.creditsPct / 100) * BAR_MAX_PX)) : 0;
    const wClass = s.weeklyPct  !== null ? (s.weeklyPct  >= 80 ? 'crit' : s.weeklyPct  >= 60 ? 'warn' : 'ok') : '';
    const sClass = s.sessionPct !== null ? (s.sessionPct >= 80 ? 'crit' : s.sessionPct >= 60 ? 'warn' : 'ok') : '';
    const cClass = s.creditsPct !== null ? (s.creditsPct >= 80 ? 'crit' : s.creditsPct >= 60 ? 'warn' : '') : '';
    const todayClass  = s.isToday  ? ' today'  : '';
    const futureClass = s.isFuture ? ' future' : '';
    const creditsBar  = hasCredits
      ? `<div class="daily-bar credits ${cClass}" style="height:${cPx}px"></div>`
      : '';

    // Tooltip
    let tooltipHtml = '';
    if (s.weeklyPct !== null) {
      const accumTotal = s.sessionAccum + (s.sessionPct ?? 0);
      const sessionLine = s.sessionPct !== null
        ? `<div><span class="tip-dot session"></span>${t.tooltipSession}: <b>${s.sessionPct}%</b></div>`
        : '';
      const resetLine = s.sessionResets > 1
        ? `<div class="tip-resets">${t.tooltipResets(s.sessionResets)} · ${t.tooltipAccum(accumTotal)}</div>`
        : '';
      const weeklyLine = `<div><span class="tip-dot weekly"></span>${t.tooltipWeekly}: <b>${s.weeklyPct}%</b></div>`;
      const creditsLine = s.creditsPct !== null
        ? `<div><span class="tip-dot credits"></span>${t.tooltipCredits}: <b>${s.creditsPct}%</b></div>`
        : '';
      tooltipHtml = `<div class="daily-tooltip">${sessionLine}${resetLine}${weeklyLine}${creditsLine}</div>`;
    }

    return `<div class="daily-col${todayClass}${futureClass}">
      ${tooltipHtml}
      <div class="daily-bar-wrap">
        <div class="daily-bar session ${sClass}" style="height:${sPx}px"></div>
        <div class="daily-bar weekly ${wClass}" style="height:${wPx}px"></div>
        ${creditsBar}
      </div>
      <span class="daily-day">${s.label}</span>
    </div>`;
  }).join('');
  fitWindow();
}


function updateUI(data: UsageData): void {
  const sessionPct = Math.round(data.five_hour.utilization);
  const weeklyPct  = Math.round(data.seven_day.utilization);

  if (sessionChart) updateGauge(sessionChart, sessionPct);
  if (weeklyChart)  updateGauge(weeklyChart, weeklyPct);

  (document.getElementById('pct-session') as HTMLElement).textContent =
    sessionPct > 100 ? `>${Math.min(sessionPct, 999)}%` : `${sessionPct}%`;
  (document.getElementById('pct-weekly') as HTMLElement).textContent =
    weeklyPct > 100 ? `>${Math.min(weeklyPct, 999)}%` : `${weeklyPct}%`;

  (document.getElementById('reset-session') as HTMLElement).textContent =
    formatResetsIn(data.five_hour.resets_at);
  (document.getElementById('reset-weekly') as HTMLElement).textContent =
    formatResetsIn(data.seven_day.resets_at);
  (document.getElementById('reset-at-session') as HTMLElement).textContent =
    tr().resetsAt(formatResetAt(data.five_hour.resets_at));
  (document.getElementById('reset-at-weekly') as HTMLElement).textContent =
    tr().resetsAt(formatResetAt(data.seven_day.resets_at));

  // Sonnet bar
  const sonnetRow  = document.getElementById('sonnet-row') as HTMLElement;
  const sonnetData = data.seven_day_sonnet;
  if (sonnetData) {
    const sp = Math.round(sonnetData.utilization);
    sonnetRow.style.display = 'flex';
    const fill = document.getElementById('bar-sonnet') as HTMLElement;
    fill.style.width = `${sp}%`;
    fill.className = `progress-bar-fill ${barClass(sp)}`;
    (document.getElementById('pct-sonnet') as HTMLElement).textContent = `${sp}%`;
  } else {
    sonnetRow.style.display = 'none';
  }

  // Credits bar
  const creditsRow = document.getElementById('credits-row') as HTMLElement;
  const extra = data.extra_usage;
  let hasCredits = false;
  if (extra?.is_enabled && extra.monthly_limit > 0) {
    hasCredits = true;
    const cp = Math.round((extra.used_credits / extra.monthly_limit) * 100);
    creditsRow.style.display = 'flex';
    const fill = document.getElementById('bar-credits') as HTMLElement;
    fill.style.width = `${cp}%`;
    fill.className = `progress-bar-fill ${barClass(cp)}`;
    (document.getElementById('pct-credits') as HTMLElement).textContent = `${cp}%`;
  } else {
    creditsRow.style.display = 'none';
  }

  const extraSection = document.getElementById('extra-section') as HTMLElement;
  extraSection.style.display = (data.seven_day_sonnet || hasCredits) ? 'block' : 'none';

  (document.getElementById('updated-text') as HTMLElement).textContent =
    tr().updatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  const dot = document.getElementById('status-dot') as HTMLElement;
  dot.className = 'logo-dot';

  document.getElementById('error-banner')!.classList.remove('visible');
  clearRateLimitBanner();

  updateTrayIcon(sessionPct, weeklyPct);

  // Store resets_at for daily chart
  lastWeeklyResetsAt = data.seven_day.resets_at;

  fitWindow();

}

// ── Settings ──────────────────────────────────────────────────────────────────

async function loadSettings(): Promise<void> {
  const s = await window.claudeUsage.getSettings();

  (document.getElementById('setting-startup') as HTMLInputElement).checked = s.launchAtStartup;
  (document.getElementById('setting-always-visible') as HTMLInputElement).checked = s.alwaysVisible;
  (document.getElementById('setting-notif-enabled') as HTMLInputElement).checked = s.notifications.enabled;
  (document.getElementById('setting-sound-enabled') as HTMLInputElement).checked = s.notifications.soundEnabled;
  (document.getElementById('setting-notify-on-window-reset') as HTMLInputElement).checked = s.notifications.notifyOnWindowReset;
  (document.getElementById('setting-notify-on-reset') as HTMLInputElement).checked = s.notifications.notifyOnReset;
  (document.getElementById('setting-reset-threshold') as HTMLInputElement).value = String(s.notifications.resetThreshold);
  (document.getElementById('setting-theme') as HTMLSelectElement).value = s.theme;

  const lang = s.language ?? 'en';
  currentLang = lang;
  (document.getElementById('setting-language') as HTMLSelectElement).value = lang;

  (document.getElementById('setting-session-threshold') as HTMLInputElement).value =
    String(s.notifications.sessionThreshold);
  (document.getElementById('setting-weekly-threshold') as HTMLInputElement).value =
    String(s.notifications.weeklyThreshold);

  const lblSession = document.getElementById('lbl-session-threshold');
  const lblWeekly = document.getElementById('lbl-weekly-threshold');
  const lblReset = document.getElementById('lbl-reset-threshold');
  if (lblSession) lblSession.textContent = `${s.notifications.sessionThreshold}%`;
  if (lblWeekly) lblWeekly.textContent = `${s.notifications.weeklyThreshold}%`;
  if (lblReset) lblReset.textContent = `${s.notifications.resetThreshold}%`;

  const size = s.windowSize ?? 'normal';
  (document.getElementById('setting-window-size') as HTMLSelectElement).value = size;

  const autoRefresh = s.autoRefresh ?? false;
  const autoRefreshInterval = s.autoRefreshInterval ?? 30;
  (document.getElementById('setting-auto-refresh') as HTMLInputElement).checked = autoRefresh;
  (document.getElementById('setting-auto-refresh-interval') as HTMLInputElement).value = String(autoRefreshInterval);

  applyTheme(s.theme);
  applyTranslations();
  applySize(size);
  applyAutoRefresh(autoRefresh, autoRefreshInterval);
  const notifyOnResetEl = document.getElementById('setting-notify-on-reset') as HTMLInputElement;
  (document.getElementById('row-reset-threshold') as HTMLElement).style.opacity = notifyOnResetEl.checked ? '1' : '0.4';

  // Daily chart sempre visível — carrega se já temos o resets_at
  void window.claudeUsage.getDailyHistory().then(d => {
    if (lastWeeklyResetsAt) renderDailyChart(d, lastWeeklyResetsAt);
  });
}

async function saveSettingsFromUI(): Promise<void> {
  const startup          = (document.getElementById('setting-startup') as HTMLInputElement).checked;
  const alwaysVisible    = (document.getElementById('setting-always-visible') as HTMLInputElement).checked;
  const notifOn          = (document.getElementById('setting-notif-enabled') as HTMLInputElement).checked;
  const soundEnabled     = (document.getElementById('setting-sound-enabled') as HTMLInputElement).checked;
  const notifyOnWinReset = (document.getElementById('setting-notify-on-window-reset') as HTMLInputElement).checked;
  const theme            = (document.getElementById('setting-theme') as HTMLSelectElement).value as AppSettings['theme'];
  const lang             = (document.getElementById('setting-language') as HTMLSelectElement).value as Lang;
  const windowSize       = (document.getElementById('setting-window-size') as HTMLSelectElement).value as AppSettings['windowSize'];
  const autoRefresh      = (document.getElementById('setting-auto-refresh') as HTMLInputElement).checked;
  const autoRefreshInterval = Math.max(60, Number((document.getElementById('setting-auto-refresh-interval') as HTMLInputElement).value));
  const sessionTh        = Math.min(100, Math.max(1, Number((document.getElementById('setting-session-threshold') as HTMLInputElement).value)));
  const weeklyTh         = Math.min(100, Math.max(1, Number((document.getElementById('setting-weekly-threshold') as HTMLInputElement).value)));
  const notifyOnReset    = (document.getElementById('setting-notify-on-reset') as HTMLInputElement).checked;
  const resetThreshold   = Math.min(99, Math.max(1, Number((document.getElementById('setting-reset-threshold') as HTMLInputElement).value)));

  currentLang = lang;
  applyTranslations();
  applyTheme(theme);
  applySize(windowSize);
  applyAutoRefresh(autoRefresh, autoRefreshInterval);
  (document.getElementById('row-reset-threshold') as HTMLElement).style.opacity = notifyOnReset ? '1' : '0.4';

  await window.claudeUsage.saveSettings({
    launchAtStartup: startup,
    alwaysVisible,
    theme,
    language: lang,
    windowSize,
    autoRefresh,
    autoRefreshInterval,
    notifications: {
      enabled: notifOn,
      soundEnabled,
      notifyOnWindowReset: notifyOnWinReset,
      sessionThreshold: sessionTh,
      weeklyThreshold: weeklyTh,
      notifyOnReset,
      resetThreshold,
    },
  });

  await window.claudeUsage.setStartup(startup);
}

function applyTheme(theme: AppSettings['theme']): void {
  const el = document.documentElement;
  if (theme === 'system') {
    el.removeAttribute('data-theme');
  } else {
    el.setAttribute('data-theme', theme);
  }
}

// ── Force refresh modal ───────────────────────────────────────────────────────

function showForceRefreshModal(): void {
  document.getElementById('force-refresh-modal')!.classList.remove('hidden');
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init(): void {
  sessionChart = createGauge('gauge-session');
  weeklyChart  = createGauge('gauge-weekly');

  void loadSettings();

  void window.claudeUsage.getProfile().then((profile) => {
    if (!profile) return;
    const bar     = document.getElementById('account-bar') as HTMLElement;
    const avatar  = document.getElementById('account-avatar') as HTMLElement;
    const nameEl  = document.getElementById('account-name') as HTMLElement;
    const emailEl = document.getElementById('account-email') as HTMLElement;
    const planEl  = document.getElementById('account-plan') as HTMLElement;

    const name = profile.account.display_name || profile.account.email.split('@')[0];
    avatar.textContent = name.charAt(0).toUpperCase();
    nameEl.textContent = name;
    emailEl.textContent = profile.account.email;

    if (profile.account.has_claude_max) {
      planEl.textContent = 'Max';
      planEl.className = 'account-plan plan-max';
    } else if (profile.account.has_claude_pro) {
      planEl.textContent = 'Pro';
      planEl.className = 'account-plan plan-pro';
    } else {
      planEl.textContent = 'Free';
      planEl.className = 'account-plan plan-free';
    }

    bar.style.display = 'flex';
    fitWindow();
  });

  void window.claudeUsage.getAppVersion().then((version) => {
    const el = document.getElementById('app-version');
    if (el) el.textContent = `v${version}`;
  });

  window.claudeUsage.onUsageUpdated((data) => {
    (document.getElementById('credential-modal') as HTMLElement).classList.add('hidden');
    updateUI(data);
  });

  // Atualizar gráfico quando receber dados novos
  window.claudeUsage.onUsageUpdated(() => {
    if (lastWeeklyResetsAt) {
      void window.claudeUsage.getDailyHistory().then(d => {
        renderDailyChart(d, lastWeeklyResetsAt!);
      });
    }
  });

  document.getElementById('btn-clear-history')!.addEventListener('click', async () => {
    if (!confirm(tr().clearHistoryConfirm)) return;
    await window.claudeUsage.clearDailyHistory();
    if (lastWeeklyResetsAt) renderDailyChart([], lastWeeklyResetsAt);
  });

  window.claudeUsage.onRateLimited((until, resetAt) => {
    isRateLimited = true;
    startRateLimitCountdown(until, resetAt);
  });

  window.claudeUsage.onNextPollAt((nextPollAt: number) => {
    if (autoRefreshEnabled) {
      const remaining = nextPollAt - Date.now();
      if (remaining > 0) {
        startNextPollCountdown(remaining);
      }
    }
  });

  window.claudeUsage.onError((msg) => {
    // Rate limit errors are handled by onRateLimited — don't show generic banner
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) return;

    const banner = document.getElementById('error-banner') as HTMLElement;
    banner.textContent = `${tr().errorPrefix}${msg}`;
    banner.classList.add('visible');

    const dot = document.getElementById('status-dot') as HTMLElement;
    dot.classList.add('error');

    (document.getElementById('updated-text') as HTMLElement).textContent =
      tr().failedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  });

  window.claudeUsage.onCredentialMissing((credPath: string) => {
    (document.getElementById('credential-path-value') as HTMLElement).textContent = credPath;
    const isLinux = credPath.startsWith('/');
    const winStep = document.getElementById('install-step-win') as HTMLElement;
    const linuxStep = document.getElementById('install-step-linux') as HTMLElement;
    if (winStep) winStep.style.display = isLinux ? 'none' : '';
    if (linuxStep) linuxStep.style.display = isLinux ? '' : 'none';
    (document.getElementById('credential-modal') as HTMLElement).classList.remove('hidden');
  });

  document.getElementById('credential-retry-btn')?.addEventListener('click', async () => {
    await window.claudeUsage.refreshNow();
  });

  window.claudeUsage.onUpdateAvailable(({ version, url }) => {
    const banner = document.getElementById('update-banner') as HTMLElement;
    const label  = document.getElementById('update-version-label') as HTMLElement;
    if (banner && label) {
      label.textContent = `v${version} available`;
      banner.style.display = 'flex';
      banner.dataset.url = url;
      fitWindow();
    }
  });

  document.getElementById('btn-update-download')!.addEventListener('click', () => {
    const url = (document.getElementById('update-banner') as HTMLElement)?.dataset.url;
    if (url) window.claudeUsage.openReleaseUrl(url);
  });

  document.getElementById('btn-close')!.addEventListener('click', () => {
    window.claudeUsage.closeWindow();
  });

  document.getElementById('btn-refresh')!.addEventListener('click', () => {
    if (isRateLimited) {
      showForceRefreshModal();
      return;
    }
    void window.claudeUsage.refreshNow();
    (document.getElementById('updated-text') as HTMLElement).textContent = tr().refreshingText;
  });

  document.getElementById('modal-cancel')!.addEventListener('click', () => {
    document.getElementById('force-refresh-modal')!.classList.add('hidden');
  });

  document.getElementById('modal-confirm')!.addEventListener('click', () => {
    document.getElementById('force-refresh-modal')!.classList.add('hidden');
    void window.claudeUsage.forceRefreshNow();
    (document.getElementById('updated-text') as HTMLElement).textContent = tr().refreshingText;
  });

  const settingEls = [
    'setting-startup', 'setting-always-visible',
    'setting-notif-enabled', 'setting-sound-enabled',
    'setting-notify-on-window-reset',
    'setting-notify-on-reset', 'setting-reset-threshold',
    'setting-theme', 'setting-language',
    'setting-window-size',
    'setting-auto-refresh', 'setting-auto-refresh-interval',
    'setting-session-threshold', 'setting-weekly-threshold',
  ];
  for (const id of settingEls) {
    document.getElementById(id)!.addEventListener('change', () => void saveSettingsFromUI());
  }

  document.getElementById('btn-test-notif')!.addEventListener('click', () => {
    void window.claudeUsage.testNotification();
  });

  document.getElementById('setting-session-threshold')!.addEventListener('input', (e) => {
    const lbl = document.getElementById('lbl-session-threshold');
    if (lbl) lbl.textContent = `${(e.target as HTMLInputElement).value}%`;
  });
  document.getElementById('setting-weekly-threshold')!.addEventListener('input', (e) => {
    const lbl = document.getElementById('lbl-weekly-threshold');
    if (lbl) lbl.textContent = `${(e.target as HTMLInputElement).value}%`;
  });
  document.getElementById('setting-reset-threshold')!.addEventListener('input', (e) => {
    const lbl = document.getElementById('lbl-reset-threshold');
    if (lbl) lbl.textContent = `${(e.target as HTMLInputElement).value}%`;
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (lastRenderedData) {
      updateTrayIcon(lastRenderedData.session, lastRenderedData.weekly);
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
