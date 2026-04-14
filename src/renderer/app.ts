import {
  Chart, DoughnutController, ArcElement, Tooltip,
  LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Legend,
} from 'chart.js';

Chart.register(DoughnutController, ArcElement, Tooltip, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Legend);

// ── Types ─────────────────────────────────────────────────────────────────────
interface DailySnapshot { date: string; maxWeekly: number; maxSession: number; maxCredits?: number; sessionWindowCount?: number; sessionAccum?: number }

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
  autoBackupMode: 'never' | 'before' | 'after' | 'always';
  autoBackupFolder: string;
  showDailyChart: boolean;
  showExtraBars:  boolean;
  showFooter:     boolean;
  showAccountBar: boolean;
  compactMode: boolean;
  workSchedule?: {
    enabled: boolean;
    activeDays: number[];
    workStart: string;
    workEnd: string;
    breakStart: string;
    breakEnd: string;
  };
}

declare global {
  interface Window {
    claudeUsage: {
      onUsageUpdated: (cb: (data: UsageData) => void) => void;
      onError: (cb: (msg: string) => void) => void;
      onRateLimited: (cb: (until: number, resetAt?: number) => void) => void;
      onSmartStatusUpdated: (cb: (status: import('./globals').SmartStatus) => void) => void;
      onNextPollAt: (cb: (nextPollAt: number) => void) => void;
      onLastResponse: (cb: (info: { ok: boolean; code?: number; message?: string; time: number }) => void) => void;
      getDayTimeSeries: (date: string) => Promise<{ ts: number; session: number; weekly: number; credits?: number }[]>;
      getSessionWindows: () => Promise<{ resetsAt: string; peak: number; date: string; peakTs?: number }[]>;
      getCurrentSessionWindow: () => Promise<{ resetsAt: string; peak: number; peakTs?: number } | null>;
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
      backupWeeklyData: () => Promise<string>;
      importBackup: () => Promise<{ imported: number; merged: number }>;
      updateDailySnapshot: (snapshot: { date: string; maxWeekly: number; maxSession: number; sessionAccum: number; sessionWindowCount: number }) => Promise<void>;
      chooseAutoBackupFolder: () => Promise<string | null>;
      onProfileUpdated: (cb: (profile: ProfileData) => void) => void;
      sync: {
        getStatus: () => Promise<{
          enabled: boolean;
          lastSyncAt: number;
          lastError: string;
          pendingOps: number;
          jwtExpiresAt: number;
          email: string;
        }>;
        enable: (serverUrl: string, deviceLabel?: string) => Promise<void>;
        disable: (wipeRemote?: boolean) => Promise<void>;
        triggerNow: () => Promise<void>;
        onEvent: (cb: (data: { type: string; payload: unknown }) => void) => void;
      };
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
    reportTitle:     'Usage Report',
    loadingText:      'Loading...',
    refreshText:      '↺ Refresh',
    resettingText:    'Resetting...',
    refreshingText:   'Refreshing...',
    retryingText:     'Retrying...',
    credentialExpired: 'Token expired. Please log in again.',
    credentialModalTitle: 'Credentials not found',
    credentialModalDesc: 'Log in to Claude Code so the monitor can access your usage data.',
    forcingText:      'Forcing...',
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
    lastRespOk:  (time: string) => `✓ OK · ${time}`,
    lastRespErr: (detail: string, time: string) => `✗ ${detail} · ${time}`,
    resetsIn:   (d: number, h: number, m: number) =>
      d > 0 ? `Resets in ${d}d ${h}h` : h > 0 ? `Resets in ${h}h ${m}m` : `Resets in ${m}m`,
    resetsAt:   (timeStr: string) => `at ${timeStr}`,
    nextPollIn: (t: string) => `Next update in ${t}`,
    historyLabel: 'Usage history (24h)',
    dailyHistoryLabel: 'Weekly cycle',
    clearHistoryBtn: 'Clear',
    backupHistoryBtn: 'Backup',
    importHistoryBtn: 'Import',
    importSuccess: (n: number) => `${n} day(s) imported`,
    backupSuccess: (p: string) => `Saved: ${p}`,
    clearHistoryConfirm: 'Clear usage history?',
    tooltipSession: 'Session',
    tooltipWeekly: 'Weekly',
    tooltipCredits: 'Credits',
    tooltipResets: (n: number) => `${n} resets`,
    tooltipAccum: (n: number) => `${n}% accumulated`,
    resetLegendLabel: 'Resets',
    editHistoryBtn: '✎',
    editSnapshotTitle: 'Edit day data',
    editDateLabel: 'Day',
    editSessionLabel: 'Session peak (%)',
    editAccumLabel: 'Accumulated (%)',
    editResetsLabel: 'No. resets',
    editWeeklyLabel: 'Weekly max. (%)',
    editCancelBtn: 'Cancel',
    editSaveBtn: 'Save',
    dayDetailTitle:   (d: string) => `Session history — ${d}`,
    dayDetailEmpty:   'No data for this day yet',
    dayDetailSession: 'Session (5h)',
    dayDetailWeekly:  'Weekly (7d)',
    dayDetailCredits: 'Credits',
    autoBackupTitle:      'Auto Backup',
    autoBackupModeLabel:  'Mode',
    autoBackupNever:      'Never',
    autoBackupBefore:     'Before poll',
    autoBackupAfter:      'After update',
    autoBackupAlways:     'Always',
    autoBackupFolderLabel: 'Folder',
    autoBackupChoose:     'Choose...',
    autoBackupFolderDefault: 'Default folder',
    layoutTitle:            'Layout',
    compactModeLabel:       'Compact mode',
    essentialModeLabel:     'Essential mode',
    showDailyChartLabel:    'Weekly chart',
    showExtraBarsLabel:     'Credits / Sonnet bars',
    showFooterLabel:        'Update footer',
    showGeneralSettingsLabel: 'General panel',
    showNotifSettingsLabel:   'Notifications panel',
    showBackupSettingsLabel:  'Backup panel',
    showCloudSyncSettingsLabel: 'Cloud Sync panel',
    syncNever:        'Never',
    syncJustNow:      'Just now',
    syncMinAgo:       (n: number) => `${n} min ago`,
    syncHAgo:         (n: number) => `${n}h ago`,
    syncDAgo:         (n: number) => `${n}d ago`,
    syncSoon:         'Soon',
    syncInMin:        (n: number) => `in ${n} min`,
    syncInH:          (n: number) => `in ${n}h`,
    syncNowBtn:       'Sync now',
    syncSyncingBtn:   'Syncing...',
    syncDisableBtn:   'Disable',
    syncWipeBtn:      'Wipe remote',
    syncLabelAccount: 'Account',
    syncLabelServer:  'Server',
    syncLabelLast:    'Last sync',
    syncLabelNext:    'Next sync',
    syncLabelPending: 'Pending ops',
    syncLabelError:   'Last error',
    syncLabelState:   'Status',
    syncStateSynced:  'Synced',
    syncStateSyncing: 'Sending...',
    settingsTabSmartPlan: 'Smart Plan',
    smartPlanEnableLabel: 'Enable smart scheduling',
    smartPlanActiveDays: 'Active days',
    smartPlanWorkHours: 'Work hours',
    smartPlanBreakHours: 'Break',
    smartPlanValidationError: 'Invalid schedule: break must be within work hours',
    smartPlanStart: 'From',
    smartPlanEnd: 'To',
    'smartPlan.status.blue': 'Outside configured work hours. Strategic planning paused.',
    'smartPlan.status.blue.offday': 'Today is not a configured work day. Strategic planning paused.',
    'smartPlan.status.green': 'Clear path. Start your most complex and high-context tasks now.',
    'smartPlan.status.yellow': 'Beware of overhead. Your reset will fall in the middle of your work window. Interleave heavy tasks with manual coding or prioritize lower-context files.',
    'smartPlan.status.red': 'Imminent block. Avoid sending large prompts. Focus on purely manual refactoring, PR reviews, or documentation until the reset.',
    'smartPlan.status.purple': "Workflow Synchronization: To avoid 'dead resets', we suggest sending your first message at {time} so your reset aligns perfectly with your break. Protect your focus.",
    'smartPlan.openDetails': 'Open smart schedule details',
    'headerCheckUpdate': 'Check for updates',
    'headerCost': 'Estimated cost',
    'headerSettings': 'Settings',
    'smartPlan.resetNextDay': '+1 day at {time}',
    dayShort0: 'Sun',
    dayShort1: 'Mon',
    dayShort2: 'Tue',
    dayShort3: 'Wed',
    dayShort4: 'Thu',
    dayShort5: 'Fri',
    dayShort6: 'Sat',
    spSessionLabel: 'Session (5h)',
    spTimelineTitle: 'Work schedule today',
    spModalTitle: 'Smart Plan',
    spSummaryResetAt: 'Session resets at',
    spSummaryAfterWork: 'after end of work hours',
    spSummaryBeforeEnd: 'before end of work hours',
    spLegendNow: 'Now',
    spLegendBreak: 'Break',
    spLegendReset: 'Reset',
    costModalTitle: 'Estimated Cost',
    costTabSession: 'Session',
    costTabWeekly: 'Weekly',
    costTabMonthly: 'Monthly',
    costPeriodSession: 'Current session (5h)',
    costPeriodWeekly: 'Last 7 days',
    costPeriodMonthly: 'This month',
    costBudgetOf: 'of',
    costBudgetLabel: 'Monthly budget:',
    costWarning: '⚠️ Estimated value based on standard API rates. Team/Enterprise plans may have different rates.',
  },
  'pt-BR': {
    sessionLabel:     'Sessão (5h)',
    weeklyLabel:      'Semanal (7d)',
    sonnetLabel:      'Sonnet',
    creditsLabel:     'Créditos',
    reportTitle:     'Relatório de Uso',
    loadingText:      'Carregando...',
    refreshText:      '↺ Atualizar',
    resettingText:    'Reiniciando...',
    refreshingText:   'Atualizando...',
    retryingText:     'Tentando...',
    forcingText:      'Forçando...',
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
    credentialExpired: 'Token expirado. Faça login novamente.',
    credentialModalTitle: 'Credenciais não encontrada',
    credentialModalDesc: 'Faça login no Claude Code para que o monitor possa acessar seus dados de uso.',
    rateLimitMsg:    'Limite de requisições',
    rateLimitRetry:  (t: string) => `Tentando novamente em ${t}`,
    rateLimitAt:     (time: string) => `(às ${time})`,
    rateLimitNow:    'Tentando novamente...',
    updatedAt:  (time: string) => `Atualizado: ${time}`,
    failedAt:   (time: string) => `Falhou: ${time}`,
    lastRespOk:  (time: string) => `✓ OK · ${time}`,
    lastRespErr: (detail: string, time: string) => `✗ ${detail} · ${time}`,
    resetsIn:   (d: number, h: number, m: number) =>
      d > 0 ? `Reinicia em ${d}d ${h}h` : h > 0 ? `Reinicia em ${h}h ${m}m` : `Reinicia em ${m}m`,
    resetsAt:   (timeStr: string) => `às ${timeStr}`,
    nextPollIn: (t: string) => `Próxima atualização em ${t}`,
    historyLabel: 'Histórico de uso (24h)',
    dailyHistoryLabel: 'Ciclo semanal',
    clearHistoryBtn: 'Limpar',
    backupHistoryBtn: 'Backup',
    importHistoryBtn: 'Import',
    importSuccess: (n: number) => `${n} dia(s) importado(s)`,
    backupSuccess: (p: string) => `Salvo: ${p}`,
    clearHistoryConfirm: 'Limpar histórico de uso?',
    tooltipSession: 'Sessão',
    tooltipWeekly: 'Semanal',
    tooltipCredits: 'Créditos',
    tooltipResets: (n: number) => `${n} resets`,
    tooltipAccum: (n: number) => `${n}% acumulado`,
    resetLegendLabel: 'Resets',
    editHistoryBtn: '✎',
    editSnapshotTitle: 'Editar dados do dia',
    editDateLabel: 'Dia',
    editSessionLabel: 'Sessão pico (%)',
    editAccumLabel: 'Acumulado (%)',
    editResetsLabel: 'Nº resets',
    editWeeklyLabel: 'Semanal máx. (%)',
    editCancelBtn: 'Cancelar',
    editSaveBtn: 'Salvar',
    dayDetailTitle:   (d: string) => `Histórico de sessão — ${d}`,
    dayDetailEmpty:   'Nenhum dado para este dia ainda',
    dayDetailSession: 'Sessão (5h)',
    dayDetailWeekly:  'Semanal (7d)',
    dayDetailCredits: 'Créditos',
    autoBackupTitle:      'Backup Automático',
    autoBackupModeLabel:  'Modo',
    autoBackupNever:      'Nunca',
    autoBackupBefore:     'Antes da consulta',
    autoBackupAfter:      'Após atualizar',
    autoBackupAlways:     'Sempre',
    autoBackupFolderLabel: 'Pasta',
    autoBackupChoose:     'Escolher...',
    autoBackupFolderDefault: 'Pasta padrão',
    layoutTitle:            'Layout',
    compactModeLabel:       'Modo compacto',
    essentialModeLabel:     'Modo essencial',
    showDailyChartLabel:    'Gráfico semanal',
    showExtraBarsLabel:     'Barras de créditos / Sonnet',
    showFooterLabel:        'Rodapé de atualização',
    showGeneralSettingsLabel: 'Painel Geral',
    showNotifSettingsLabel:   'Painel Notificações',
    showBackupSettingsLabel:  'Painel Backup',
    showCloudSyncSettingsLabel: 'Painel Cloud Sync',
    syncNever:        'Nunca',
    syncJustNow:      'Agora mesmo',
    syncMinAgo:       (n: number) => `${n} min atrás`,
    syncHAgo:         (n: number) => `${n}h atrás`,
    syncDAgo:         (n: number) => `${n}d atrás`,
    syncSoon:         'Em breve',
    syncInMin:        (n: number) => `em ${n} min`,
    syncInH:          (n: number) => `em ${n}h`,
    syncNowBtn:       'Sincronizar',
    syncSyncingBtn:   'Sincronizando...',
    syncDisableBtn:   'Desativar',
    syncWipeBtn:      'Limpar remoto',
    syncLabelAccount: 'Conta',
    syncLabelServer:  'Servidor',
    syncLabelLast:    'Última sync',
    syncLabelNext:    'Próxima sync',
    syncLabelPending: 'Ops pendentes',
    syncLabelError:   'Último erro',
    syncLabelState:   'Status',
    syncStateSynced:  'Sincronizado',
    syncStateSyncing: 'Enviando...',
    settingsTabSmartPlan: 'Agenda',
    smartPlanEnableLabel: 'Ativar agenda inteligente',
    smartPlanActiveDays: 'Dias ativos',
    smartPlanWorkHours: 'Horário de trabalho',
    smartPlanBreakHours: 'Intervalo',
    smartPlanValidationError: 'Agenda inválida: intervalo deve estar dentro do expediente',
    smartPlanStart: 'Início',
    smartPlanEnd: 'Fim',
    'smartPlan.status.blue': 'Fora do horário comercial configurado. Planejamento estratégico pausado.',
    'smartPlan.status.blue.offday': 'Hoje não é um dia de trabalho configurado. Planejamento estratégico pausado.',
    'smartPlan.status.green': 'Caminho livre. Inicie suas tarefas mais complexas e de alto consumo de contexto agora.',
    'smartPlan.status.yellow': 'Cuidado com o overhead. Seu reset cairá no meio da sua janela de trabalho. Intercale tarefas pesadas com codificação manual ou priorize arquivos de menor contexto.',
    'smartPlan.status.red': 'Bloqueio iminente. Evite enviar prompts grandes. Concentre-se em refatorações puramente manuais, revisão de PRs ou documentação até o reset.',
    'smartPlan.status.purple': "Sincronização de Fluxo de trabalho: Para evitar 'resets mortos', sugerimos disparar sua primeira mensagem às {time} para que seu reset alinhe perfeitamente com seu intervalo. Proteja seu foco.",
    'smartPlan.openDetails': 'Abrir detalhes da agenda',
    'headerCheckUpdate': 'Verificar atualizações',
    'headerCost': 'Custo estimado',
    'headerSettings': 'Configurações',
    'smartPlan.resetNextDay': '+1 dia às {time}',
    dayShort0: 'Dom',
    dayShort1: 'Seg',
    dayShort2: 'Ter',
    dayShort3: 'Qua',
    dayShort4: 'Qui',
    dayShort5: 'Sex',
    dayShort6: 'Sáb',
    spSessionLabel: 'Sessão (5h)',
    spTimelineTitle: 'Expediente hoje',
    spModalTitle: 'Smart Plan',
    spSummaryResetAt: 'Sessão reinicia às',
    spSummaryAfterWork: 'após o fim do expediente',
    spSummaryBeforeEnd: 'antes do fim do expediente',
    spLegendNow: 'Agora',
    spLegendBreak: 'Intervalo',
    spLegendReset: 'Reset',
    costModalTitle: 'Custo Estimado',
    costTabSession: 'Sessão',
    costTabWeekly: 'Semanal',
    costTabMonthly: 'Mensal',
    costPeriodSession: 'Sessão atual (5h)',
    costPeriodWeekly: 'Últimos 7 dias',
    costPeriodMonthly: 'Este mês',
    costBudgetOf: 'de',
    costBudgetLabel: 'Orçamento mensal:',
    costWarning: '⚠️ Valor estimado baseado na API padrão. Planos Team/Enterprise podem ter taxas diferentes.',
  },
} as const;

type Translations = typeof translations.en;

let currentLang: Lang = 'en';
let currentSmartStatus: import('./globals').SmartStatus | null = null;

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

  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle as keyof Translations;
    const val = t[key];
    if (typeof val === 'string') {
      el.title = val;
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
    const header      = document.querySelector('.header') as HTMLElement;
    const accountBar  = document.getElementById('account-bar') as HTMLElement;
    const smartRecBar = document.getElementById('smart-rec-bar') as HTMLElement;
    const content     = document.querySelector('.content') as HTMLElement;
    const footer      = document.querySelector('.footer') as HTMLElement;
    const accountBarH = (accountBar?.style.display !== 'none' ? accountBar?.offsetHeight : 0) ?? 0;
    const h = header.offsetHeight + accountBarH + (smartRecBar?.offsetHeight ?? 0) + content.scrollHeight + (footer?.offsetHeight ?? 0);
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
let extraSectionAllowed = true;
let showAccountBar = true;

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

  // Render at 64×64 for crisp downscaling by the OS (looks sharp at 16–32px tray sizes)
  const size = 64;
  const cx = size / 2;
  const cy = size / 2;
  ctx.clearRect(0, 0, size, size);

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const bgColor = isDark ? 'rgba(28, 28, 28, 0.90)' : 'rgba(235, 235, 235, 0.95)';
  const textColor = isDark ? '#ffffff' : '#111111';
  const trackColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';

  // Background circle
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 - 1, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();

  const maxPct = Math.max(sessionPct, weeklyPct);
  const arcRadius = size / 2 - 7;  // 25px at 64px canvas
  const arcWidth = 8;

  // Track (empty arc)
  ctx.beginPath();
  ctx.arc(cx, cy, arcRadius, 0, Math.PI * 2);
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = arcWidth;
  ctx.stroke();

  // Progress arc
  const color = colorForPct(maxPct);
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (Math.min(maxPct, 100) / 100) * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, arcRadius, startAngle, endAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = arcWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Center label - just show colored circle, no text
  ctx.fillStyle = textColor;

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
let costGaugeChart: Chart | null = null;
let lastRenderedData: { session: number; weekly: number } | null = null;
let sessionResetTimer: ReturnType<typeof setTimeout> | null = null;

// ── Daily cycle chart ─────────────────────────────────────────────────────────

let lastWeeklyResetsAt: string | null = null;
let lastWeeklyPct: number | null = null;
let lastSessionPct: number | null = null;
let lastUpdatedTime: string | null = null;
let currentDailyHistory: DailySnapshot[] = [];
let dayDetailChart: Chart | null = null;
let reportChart: Chart | null = null;
let dayCurveChart: Chart | null = null;
let dayCurveOpenDate: string | null = null;

async function openReportModal(): Promise<void> {
  const modal = document.getElementById('report-modal')!;
  modal.classList.remove('hidden');

  const [dailyHistory, sessionWindows, currentWindow] = await Promise.all([
    window.claudeUsage.getDailyHistory(),
    window.claudeUsage.getSessionWindows(),
    window.claudeUsage.getCurrentSessionWindow(),
  ]);

  const sorted = [...(dailyHistory ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  const locale = currentLang === 'pt-BR' ? 'pt-BR' : 'en';
  const labels = sorted.map(d => {
    const dt = new Date(d.date + 'T12:00:00');
    return dt.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  });
  const sessionData = sorted.map(d => Math.min(d.maxSession, 200));
  const weeklyData  = sorted.map(d => Math.min(d.maxWeekly,  200));

  const peakSession = sorted.length ? Math.max(...sorted.map(d => d.maxSession)) : 0;
  const avgSession  = sorted.length ? Math.round(sorted.reduce((s, d) => s + d.maxSession, 0) / sorted.length) : 0;
  const totalWindows = (sessionWindows ?? []).length + (currentWindow ? 1 : 0);
  const allPeaks = [...(sessionWindows ?? []).map(w => w.peak), ...(currentWindow ? [currentWindow.peak] : [])];
  const peakWindow = allPeaks.length ? Math.max(...allPeaks) : 0;

  const tickColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#aaa';
  const gridColor = 'rgba(128,128,128,0.15)';

  if (reportChart) { reportChart.destroy(); reportChart = null; }

  const canvas = document.getElementById('report-chart') as HTMLCanvasElement;
  reportChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: currentLang === 'pt-BR' ? 'Sessão pico' : 'Session peak',
          data: sessionData,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.12)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#22c55e',
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: tickColor, font: { size: 10 }, boxWidth: 10, padding: 10 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}%`,
          },
        },
      },
      scales: {
        y: {
          min: 0,
          max: Math.max(100, peakSession + 10, peakWindow + 10),
          ticks: { color: tickColor, font: { size: 9 }, callback: v => `${v}%` },
          grid: { color: gridColor },
        },
        x: {
          ticks: { color: tickColor, font: { size: 9 }, maxRotation: 45 },
          grid: { color: gridColor },
        },
      },
    },
  });

  // Stats cards
  const statsEl = document.getElementById('report-stats')!;
  const statItems = currentLang === 'pt-BR'
    ? [
        { label: 'Dias monitorados', value: `${sorted.length}` },
        { label: 'Pico de sessão',   value: `${peakSession}%` },
        { label: 'Média de sessão',  value: `${avgSession}%` },
        { label: 'Janelas de sessão', value: `${totalWindows}` },
      ]
    : [
        { label: 'Monitored days',   value: `${sorted.length}` },
        { label: 'Session peak',     value: `${peakSession}%` },
        { label: 'Session average',  value: `${avgSession}%` },
        { label: 'Session windows',  value: `${totalWindows}` },
      ];
  statsEl.innerHTML = statItems
    .map(s => `<div class="stat-card"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`)
    .join('');

  // Session windows list
  const windowsEl = document.getElementById('report-windows')!;
  if (!sessionWindows || sessionWindows.length === 0) {
    windowsEl.innerHTML = '';
    return;
  }
  const recentWindows = [...sessionWindows].reverse().slice(0, 10);
  const windowsTitle = currentLang === 'pt-BR' ? 'Janelas recentes (5h)' : 'Recent windows (5h)';
  const isPtBR = currentLang === 'pt-BR';
  const fmt = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const buildRow = (resetsAt: string, peak: number, final: number, index: number, isOpen: boolean, peakTs?: number) => {
    const endDt   = new Date(resetsAt);
    const startDt = new Date(endDt.getTime() - 5 * 60 * 60 * 1000);
    const fmtDate = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    const startStr = `${fmtDate(startDt)} ${fmt(startDt)}`;
    const hasActivity = peak > 0 || final > 0;
    const effectiveIsOpen = isOpen && hasActivity;
    const rangeStr = effectiveIsOpen
      ? `${startStr} → ${isPtBR ? 'em andamento' : 'ongoing'}`
      : `${startStr} → ${fmtDate(endDt)} ${fmt(endDt)}`;
    const pct   = effectiveIsOpen ? Math.min(peak, 200) : Math.min(final, 200);
    const color = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e';
    const label = isPtBR ? `Janela ${index}` : `Window ${index}`;
    const badge = effectiveIsOpen
      ? `<span class="window-badge open">${isPtBR ? 'Aberta' : 'Open'}</span>`
      : `<span class="window-badge closed">${isPtBR ? 'Fechada' : 'Closed'}</span>`;
    const peakTimeStr = peakTs
      ? new Date(peakTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;
    const peakTimeHtml = peakTimeStr
      ? `<span class="window-peak-time">${isPtBR ? 'pico' : 'peak at'} ${peakTimeStr}</span>`
      : '';
    return `<div class="report-window-row">
      <span class="report-window-label">${label} ${badge}</span>
      <span class="report-window-date">${rangeStr}</span>
      <span class="report-window-peak" style="color:${color}">${pct}%${peakTimeHtml}</span>
    </div>`;
  };

  let windowRows = '';
  let idx = 1;
  if (currentWindow) {
    windowRows += buildRow(currentWindow.resetsAt, currentWindow.peak, currentWindow.final ?? currentWindow.peak, idx++, true, currentWindow.peakTs);
  }
  windowRows += recentWindows.map(w => buildRow(w.resetsAt, w.peak, w.final ?? w.peak, idx++, false, w.peakTs)).join('');

  windowsEl.innerHTML = `<div class="report-windows-title">${windowsTitle}</div>` + windowRows;

  // Resumo analítico
  const analyticsEl = document.getElementById('report-analytics');
  if (analyticsEl) {
    const today = new Date().toLocaleDateString('sv');
    const allW = [...recentWindows] as { resetsAt: string; peak: number; date: string; peakTs?: number }[];
    if (currentWindow) allW.push({ resetsAt: currentWindow.resetsAt, peak: currentWindow.peak, date: today, peakTs: currentWindow.peakTs });

    const byDate = new Map<string, number>();
    allW.forEach(w => byDate.set(w.date, (byDate.get(w.date) ?? 0) + 1));
    const avgPerDay = byDate.size > 0
      ? (Array.from(byDate.values()).reduce((a, b) => a + b, 0) / byDate.size).toFixed(1)
      : '—';

    const withPeak = allW.filter(w => w.peakTs != null);
    let peakInterval = '—';
    if (withPeak.length > 0) {
      const hourBuckets = new Array(24).fill(0) as number[];
      withPeak.forEach(w => hourBuckets[new Date(w.peakTs!).getHours()]++);
      const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));
      peakInterval = `${String(peakHour).padStart(2,'0')}h–${String(peakHour+1).padStart(2,'0')}h`;
    }

    const sortedDH = [...dailyHistory].sort((a, b) => a.date.localeCompare(b.date));
    let streak = 0;
    for (let i = sortedDH.length - 1; i >= 0; i--) {
      if (sortedDH[i].maxSession >= 80) streak++;
      else break;
    }

    analyticsEl.innerHTML = `
      <div class="analytics-title">${isPtBR ? 'Resumo' : 'Summary'}</div>
      <div class="stat-card"><div class="stat-value">${avgPerDay}</div><div class="stat-label">${isPtBR ? 'Janelas/dia' : 'Windows/day'}</div></div>
      <div class="stat-card"><div class="stat-value">${peakInterval}</div><div class="stat-label">${isPtBR ? 'Pico comum' : 'Common peak'}</div></div>
      <div class="stat-card"><div class="stat-value">${streak}</div><div class="stat-label">${isPtBR ? 'Dias >80%' : 'Days >80%'}</div></div>
    `;
  }
}

async function openDayDetailModal(date: string): Promise<void> {
  const modal    = document.getElementById('day-detail-modal')!;
  const titleEl  = document.getElementById('day-detail-title')!;
  const emptyEl  = document.getElementById('day-detail-empty')!;
  const canvas   = document.getElementById('day-detail-canvas') as HTMLCanvasElement;
  const t = tr();

  // Format display date
  const d = new Date(date + 'T12:00:00');
  const locale = currentLang === 'pt-BR' ? 'pt-BR' : 'en';
  titleEl.textContent = t.dayDetailTitle(d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' }));

  // Destroy previous chart
  if (dayDetailChart) { dayDetailChart.destroy(); dayDetailChart = null; }

  modal.classList.remove('hidden');

  const [points, windows] = await Promise.all([
    window.claudeUsage.getDayTimeSeries(date),
    window.claudeUsage.getSessionWindows(),
  ]);

  if (!points || points.length === 0) {
    canvas.style.display = 'none';
    emptyEl.textContent = t.dayDetailEmpty;
    emptyEl.classList.remove('hidden');
    return;
  }

  canvas.style.display = '';
  emptyEl.classList.add('hidden');

  const tickColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#aaa';
  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark'
    || (document.documentElement.getAttribute('data-theme') === null && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const sessionBorder = '#a78bfa';
  const weeklyBorder  = '#60a5fa';
  const creditsBorder = '#22c55e';
  const sessionFill   = isDarkMode ? 'rgba(167,139,250,0.38)' : 'rgba(167,139,250,0.22)';
  const weeklyFill    = isDarkMode ? 'rgba(96,165,250,0.28)'  : 'rgba(96,165,250,0.15)';
  const creditsFill   = isDarkMode ? 'rgba(34,197,94,0.28)'   : 'rgba(34,197,94,0.15)';

  const labels  = points.map(p => new Date(p.ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }));
  const session = points.map(p => Math.min(p.session, 100));
  const weekly  = points.map(p => Math.min(p.weekly,  100));
  const credits = points.map(p => p.credits != null ? Math.min(p.credits, 100) : null);
  const hasCredits = credits.some(v => v !== null);

  // Reset markers: sessionWindows that belong to this date
  const resets = (windows ?? []).filter(w => w.date === date);

  // Vertical line plugin for reset markers
  const resetPlugin = {
    id: 'resetLines',
    afterDraw(chart: Chart) {
      const ctx  = chart.ctx;
      const xAxis = chart.scales['x'];
      const yAxis = chart.scales['y'];
      resets.forEach(w => {
        const resetTs = new Date(w.resetsAt).getTime();
        // Find the closest label index
        let closest = 0;
        let minDiff = Infinity;
        points.forEach((p, i) => {
          const diff = Math.abs(p.ts - resetTs);
          if (diff < minDiff) { minDiff = diff; closest = i; }
        });
        const x = xAxis.getPixelForValue(closest);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, yAxis.top);
        ctx.lineTo(x, yAxis.bottom);
        ctx.strokeStyle = 'rgba(249,115,22,0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.restore();
      });
    },
  };

  dayDetailChart = new Chart(canvas, {
    type: 'line',
    plugins: [resetPlugin],
    data: {
      labels,
      datasets: [
        {
          label: t.dayDetailSession,
          data: session,
          borderColor: sessionBorder,
          backgroundColor: sessionFill,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: t.dayDetailWeekly,
          data: weekly,
          borderColor: weeklyBorder,
          backgroundColor: weeklyFill,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
        ...(hasCredits ? [{
          label: t.dayDetailCredits,
          data: credits,
          borderColor: creditsBorder,
          backgroundColor: creditsFill,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
          spanGaps: true,
        }] : []),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          ticks: { maxTicksLimit: 6, color: tickColor, font: { size: 10 } },
          grid: { color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
        },
        y: {
          min: 0,
          max: 100,
          ticks: { stepSize: 25, color: tickColor, font: { size: 10 }, callback: (v) => `${v}%` },
          grid: { color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
        },
      },
      plugins: {
        legend: {
          display: true,
          labels: { color: isDarkMode ? '#d0d0d0' : '#555555', font: { size: 10 }, boxWidth: 10, padding: 8 },
        },
        tooltip: { mode: 'index', intersect: false },
      },
    },
  });
}

function renderDailyChart(dailyData: DailySnapshot[], weeklyResetsAt: string, liveWeeklyPct?: number, liveSessionPct?: number): void {
  const container = document.getElementById('daily-chart');
  if (!container) return;
  currentDailyHistory = dailyData;

  const resetDate = new Date(weeklyResetsAt);
  const cycleStartMs = resetDate.getTime() - 7 * 24 * 60 * 60 * 1000;

  // Detectar se créditos existem em algum dia do histórico
  const hasCredits = dailyData.some(d => d.maxCredits !== undefined);
  const hasResets  = dailyData.some(d => (d.sessionWindowCount ?? 1) > 1);

  // Build 7 day slots
  const slots: {
    date: string; label: string; isToday: boolean; isFuture: boolean;
    weeklyPct: number | null; sessionPct: number | null; creditsPct: number | null;
    sessionWindowCount: number; sessionAccum: number;
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
      weeklyPct:    isToday && liveWeeklyPct !== undefined
        ? Math.min(liveWeeklyPct, 100)
        : found ? Math.min(found.maxWeekly, 100) : null,
      sessionPct:   isToday && liveSessionPct !== undefined
        ? Math.min(liveSessionPct, 100)
        : found ? Math.min(found.maxSession ?? 0, 100) : null,
      creditsPct:   (found && found.maxCredits !== undefined) ? Math.min(found.maxCredits, 100) : null,
      sessionWindowCount: found?.sessionWindowCount ?? 1,
      sessionAccum:  found?.sessionAccum  ?? 0,
    });
  }

  const t   = tr();

  // Legenda dinâmica
  const legendEl = document.getElementById('daily-legend');
  if (legendEl) {
    legendEl.innerHTML = [
      `<span class="legend-dot session"></span><span class="legend-text">${t.sessionLabel}</span>`,
      `<span class="legend-dot weekly"></span><span class="legend-text">${t.weeklyLabel}</span>`,
      ...(hasCredits ? [`<span class="legend-dot credits"></span><span class="legend-text">${t.creditsLabel}</span>`] : []),
      ...(hasResets  ? [`<span class="legend-dot reset"></span><span class="legend-text">${t.resetLegendLabel}</span>`] : []),
    ].join('');
  }

  const BAR_MAX_PX = 40;
  container.innerHTML = slots.map(s => {
    const wPx = s.weeklyPct  !== null ? Math.max(3, Math.round((s.weeklyPct  / 100) * BAR_MAX_PX)) : 0;
    const accumTotal = s.sessionAccum + (s.sessionPct ?? 0);
    const totalSessionPct = Math.min(accumTotal, 100);
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
    const resetBadge = (!s.isFuture && s.sessionWindowCount > 1)
      ? `<div class="reset-badge">${Math.max(0, s.sessionWindowCount - 1)}</div>`
      : '';

    // Tooltip
    let tooltipHtml = '';
    if (s.weeklyPct !== null) {
      const sessionLine = s.sessionPct !== null
        ? `<div><span class="tip-dot session"></span>${t.tooltipSession}: <b>${s.sessionPct}%</b></div>`
        : '';
      const resetLine = (s.sessionAccum > 0 || s.sessionWindowCount > 1)
        ? `<div class="tip-resets">${t.tooltipResets(Math.max(0, s.sessionWindowCount - 1))} · ${t.tooltipAccum(accumTotal)}</div>`
        : '';
      const weeklyLine = `<div><span class="tip-dot weekly"></span>${t.tooltipWeekly}: <b>${s.weeklyPct}%</b></div>`;
      const creditsLine = s.creditsPct !== null
        ? `<div><span class="tip-dot credits"></span>${t.tooltipCredits}: <b>${s.creditsPct}%</b></div>`
        : '';
      tooltipHtml = `<div class="daily-tooltip">${sessionLine}${resetLine}${weeklyLine}${creditsLine}</div>`;
    }

    return `<div class="daily-col${todayClass}${futureClass}" data-date="${s.date}">
      ${tooltipHtml}
      <div class="daily-bar-wrap">
        <div class="session-bar-slot">
          ${resetBadge}
          <div class="daily-bar session ${sClass}" style="height:${sPx}px"></div>
        </div>
        <div class="daily-bar weekly ${wClass}" style="height:${wPx}px"></div>
        ${creditsBar}
      </div>
      <span class="daily-day">${s.label}</span>
    </div>`;
  }).join('');

  container.querySelectorAll<HTMLElement>('.daily-col:not(.future)[data-date]').forEach(col => {
    col.addEventListener('click', () => {
      const date = col.dataset.date;
      if (date) void openDayDetailModal(date);
    });
  });

  fitWindow();
}


async function updateBurnRate(): Promise<void> {
  const el = document.getElementById('burn-rate-line');
  if (!el) return;
  const today = new Date().toLocaleDateString('sv');
  const points = await window.claudeUsage.getDayTimeSeries(today);
  if (points.length < 2) { el.textContent = ''; return; }
  const newest = points[points.length - 1];
  const minWindowMs = 10 * 60_000;
  const oldest = [...points].slice(0, -1).reverse().find(p => newest.ts - p.ts >= minWindowMs)
    ?? points[points.length - 2];
  const currentSession = newest.session;
  if (currentSession < 5) { el.textContent = ''; return; }
  const deltaPct = newest.session - oldest.session;
  const deltaHours = (newest.ts - oldest.ts) / 3_600_000;
  if (deltaHours <= 0) { el.textContent = ''; return; }
  const burnRate = deltaPct / deltaHours;
  if (burnRate <= 0) { el.textContent = ''; return; }
  const remainingPct = 100 - currentSession;
  const hoursUntilFull = remainingPct / burnRate;
  if (hoursUntilFull > 6) { el.textContent = ''; return; }
  const estTime = new Date(newest.ts + hoursUntilFull * 3_600_000);
  const timeStr = estTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const rateStr = burnRate.toFixed(1);
  const isPtBR = document.documentElement.lang === 'pt-BR' || navigator.language.startsWith('pt');
  el.textContent = isPtBR
    ? `↑ ${rateStr}%/h · esgota ~${timeStr}`
    : `↑ ${rateStr}%/h · exhausts ~${timeStr}`;
}

async function updateWeeklyBurnRate(): Promise<void> {
  const el = document.getElementById('burn-rate-line-weekly');
  if (!el) return;
  const today = new Date().toLocaleDateString('sv');
  const points = await window.claudeUsage.getDayTimeSeries(today);
  if (points.length < 2) { el.textContent = ''; return; }
  const newest = points[points.length - 1];
  const minWindowMs = 10 * 60_000;
  const oldest = [...points].slice(0, -1).reverse().find(p => newest.ts - p.ts >= minWindowMs)
    ?? points[points.length - 2];
  const currentWeekly = newest.weekly;
  if (currentWeekly < 5) { el.textContent = ''; return; }
  const deltaPct = newest.weekly - oldest.weekly;
  const deltaHours = (newest.ts - oldest.ts) / 3_600_000;
  if (deltaHours <= 0) { el.textContent = ''; return; }
  const burnRate = deltaPct / deltaHours;
  if (burnRate <= 0) { el.textContent = ''; return; }
  const remainingPct = 100 - currentWeekly;
  const hoursUntilFull = remainingPct / burnRate;
  if (hoursUntilFull > 48) { el.textContent = ''; return; }
  const estTime = new Date(newest.ts + hoursUntilFull * 3_600_000);
  const isPtBR = document.documentElement.lang === 'pt-BR' || navigator.language.startsWith('pt');
  const now = new Date();
  const isToday = estTime.toLocaleDateString('sv') === now.toLocaleDateString('sv');
  let timeStr: string;
  if (isToday) {
    timeStr = estTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    const weekday = estTime.toLocaleDateString(isPtBR ? 'pt-BR' : 'en', { weekday: 'short' });
    const t = estTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    timeStr = `${weekday} ${t}`;
  }
  const rateStr = burnRate.toFixed(1);
  el.textContent = isPtBR
    ? `↑ ${rateStr}%/h · esgota ~${timeStr}`
    : `↑ ${rateStr}%/h · exhausts ~${timeStr}`;
}

async function openDayCurvePopup(date: string, anchorEl: HTMLElement): Promise<void> {
  const popup = document.getElementById('day-curve-popup') as HTMLElement;
  const titleEl = document.getElementById('day-curve-title') as HTMLElement;
  const emptyEl = document.getElementById('day-curve-empty') as HTMLElement;
  const closeBtn = document.getElementById('day-curve-close') as HTMLElement;

  if (dayCurveOpenDate === date && !popup.classList.contains('hidden')) {
    closeDayCurvePopup();
    return;
  }

  const rect = anchorEl.getBoundingClientRect();
  popup.style.left = `${Math.min(rect.left, window.innerWidth - 250)}px`;
  popup.style.top = `${rect.bottom + 4}px`;

  titleEl.textContent = new Date(date + 'T12:00:00').toLocaleDateString([], { day: '2-digit', month: 'short' });
  popup.classList.remove('hidden');
  dayCurveOpenDate = date;

  if (dayCurveChart) { dayCurveChart.destroy(); dayCurveChart = null; }

  const points = await window.claudeUsage.getDayTimeSeries(date);

  if (points.length < 2) {
    document.querySelector('.day-curve-chart-wrap')!.setAttribute('style', 'display:none');
    emptyEl.classList.remove('hidden');
  } else {
    document.querySelector('.day-curve-chart-wrap')!.setAttribute('style', '');
    emptyEl.classList.add('hidden');
    const labels = points.map(p => new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const canvas = document.getElementById('day-curve-canvas') as HTMLCanvasElement;
    dayCurveChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: points.map(p => Math.min(p.session, 100)),
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76,175,80,0.15)',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false, min: 0, max: 100 },
        },
        animation: false,
      },
    });
  }

  closeBtn.onclick = closeDayCurvePopup;
}

function closeDayCurvePopup(): void {
  const popup = document.getElementById('day-curve-popup');
  if (popup) popup.classList.add('hidden');
  if (dayCurveChart) { dayCurveChart.destroy(); dayCurveChart = null; }
  dayCurveOpenDate = null;
}

function updateUI(data: UsageData): void {
  const sessionPct = Math.round(data.five_hour.utilization);
  const weeklyPct  = Math.round(data.seven_day.utilization);

  if (weeklyPct) updateGauge(weeklyChart, weeklyPct);

  (document.getElementById('pct-weekly') as HTMLElement).textContent =
    weeklyPct > 100 ? `>${Math.min(weeklyPct, 999)}%` : `${weeklyPct}%`;

  const today = new Date().toLocaleDateString('sv');
  window.claudeUsage.getDailyHistory().then(history => {
    const todayData = history.find(d => d.date === today);
    const noSessionData = !todayData || (todayData.maxSession === 0 && todayData.sessionAccum === 0);
    if (noSessionData) {
      (document.getElementById('pct-session') as HTMLElement).textContent = '—';
      (document.getElementById('reset-session') as HTMLElement).textContent = '—';
      (document.getElementById('reset-at-session') as HTMLElement).textContent = '—';
      if (sessionChart) updateGauge(sessionChart, 0);
    } else {
      (document.getElementById('pct-session') as HTMLElement).textContent = sessionPct > 100 ? `>${Math.min(sessionPct, 999)}%` : `${sessionPct}%`;
      (document.getElementById('reset-session') as HTMLElement).textContent = formatResetsIn(data.five_hour.resets_at);
      (document.getElementById('reset-at-session') as HTMLElement).textContent = tr().resetsAt(formatResetAt(data.five_hour.resets_at));
      if (sessionChart) updateGauge(sessionChart, sessionPct);
    }
  });

  // Weekly gauge
  (document.getElementById('pct-weekly') as HTMLElement).textContent =
    weeklyPct > 100 ? `>${Math.min(weeklyPct, 999)}%` : `${weeklyPct}%`;
  (document.getElementById('reset-weekly') as HTMLElement).textContent = formatResetsIn(data.seven_day.resets_at);
  (document.getElementById('reset-at-weekly') as HTMLElement).textContent = tr().resetsAt(formatResetAt(data.seven_day.resets_at));

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
  extraSection.style.display =
    (extraSectionAllowed && (data.seven_day_sonnet || hasCredits)) ? 'block' : 'none';

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  lastUpdatedTime = now;
  (document.getElementById('updated-text') as HTMLElement).textContent = tr().updatedAt(now);

  const dot = document.getElementById('status-dot') as HTMLElement;
  dot.className = 'logo-dot';

  document.getElementById('error-banner')!.classList.remove('visible');
  clearRateLimitBanner();

  updateTrayIcon(sessionPct, weeklyPct);

  // Store resets_at and current pcts for daily chart
  lastWeeklyResetsAt = data.seven_day.resets_at;
  lastWeeklyPct = weeklyPct;
  lastSessionPct = sessionPct;

  // Zera o gauge de sessão localmente quando a janela de 5h expira, sem esperar o próximo poll
  if (sessionResetTimer) clearTimeout(sessionResetTimer);
  const msUntilSessionReset = new Date(data.five_hour.resets_at).getTime() - Date.now();
  if (msUntilSessionReset > 0) {
    sessionResetTimer = setTimeout(() => {
      sessionResetTimer = null;
      if (sessionChart) updateGauge(sessionChart, 0);
      (document.getElementById('pct-session') as HTMLElement).textContent = '0%';
      updateTrayIcon(0, lastRenderedData?.weekly ?? 0);
      void window.claudeUsage.refreshNow();
    }, msUntilSessionReset);
  }

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
  applyTranslations();
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

  const autoBackupMode = s.autoBackupMode ?? 'never';
  (document.getElementById('setting-auto-backup-mode') as HTMLSelectElement).value = autoBackupMode;
  const lblFolder = document.getElementById('lbl-auto-backup-folder');
  if (lblFolder) lblFolder.textContent = s.autoBackupFolder || tr().autoBackupFolderDefault;
  (document.getElementById('row-auto-backup-folder') as HTMLElement).style.display =
    autoBackupMode === 'never' ? 'none' : '';

  applyTheme(s.theme);
  applyTranslations();
  applySize(size);
  applyAutoRefresh(autoRefresh, autoRefreshInterval);
  const showDailyChart = s.showDailyChart ?? true;
  const showExtraBars  = s.showExtraBars  ?? true;
  const showFooter     = s.showFooter     ?? true;
  const showAccBar     = s.showAccountBar ?? true;
  const compactMode    = s.compactMode    ?? false;
  showAccountBar = showAccBar;
  (document.getElementById('setting-compact-mode')       as HTMLInputElement).checked = compactMode;
  (document.getElementById('setting-show-daily-chart')   as HTMLInputElement).checked = showDailyChart;
  (document.getElementById('setting-show-extra-bars')    as HTMLInputElement).checked = showExtraBars;
  (document.getElementById('setting-show-footer')        as HTMLInputElement).checked = showFooter;
  (document.getElementById('setting-show-account-bar')   as HTMLInputElement).checked = showAccBar;
  applySectionVisibility({ showDailyChart, showExtraBars, showFooter, showAccountBar: showAccBar });

  // Smart Plan
  const ws = (s as AppSettings & { workSchedule?: { enabled: boolean; activeDays: number[]; workStart: string; workEnd: string; breakStart: string; breakEnd: string } }).workSchedule;
  if (ws) {
    (document.getElementById('sp-enabled') as HTMLInputElement).checked = ws.enabled;
    [0,1,2,3,4,5,6].forEach(d => {
      const cb = document.getElementById(`sp-day-${d}`) as HTMLInputElement;
      if (cb) cb.checked = ws.activeDays.includes(d);
    });
    (document.getElementById('sp-work-start') as HTMLInputElement).value = ws.workStart;
    (document.getElementById('sp-work-end') as HTMLInputElement).value = ws.workEnd;
    (document.getElementById('sp-break-start') as HTMLInputElement).value = ws.breakStart;
    (document.getElementById('sp-break-end') as HTMLInputElement).value = ws.breakEnd;
  }

  // Popula estado inicial da seção Cloud Sync
  void loadCloudSyncStatus();
  setInterval(refreshSyncTimes, 30_000);
  const notifyOnResetEl = document.getElementById('setting-notify-on-reset') as HTMLInputElement;
  (document.getElementById('row-reset-threshold') as HTMLElement).style.opacity = notifyOnResetEl.checked ? '1' : '0.4';

  // Daily chart sempre visível — carrega se já temos o resets_at
  void window.claudeUsage.getDailyHistory().then(d => {
    if (lastWeeklyResetsAt) renderDailyChart(d, lastWeeklyResetsAt, lastWeeklyPct ?? undefined, lastSessionPct ?? undefined);
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
  const autoBackupMode   = (document.getElementById('setting-auto-backup-mode') as HTMLSelectElement).value as AppSettings['autoBackupMode'];
  const showDailyChart   = (document.getElementById('setting-show-daily-chart')  as HTMLInputElement).checked;
  const showExtraBars    = (document.getElementById('setting-show-extra-bars')   as HTMLInputElement).checked;
  const showFooter       = (document.getElementById('setting-show-footer')       as HTMLInputElement).checked;
  const showAccBar       = (document.getElementById('setting-show-account-bar')  as HTMLInputElement).checked;
  const compactMode      = (document.getElementById('setting-compact-mode')      as HTMLInputElement).checked;

  showAccountBar = showAccBar;

  currentLang = lang;
  applyTranslations();
  applyTheme(theme);
  applySize(windowSize);
  applyAutoRefresh(autoRefresh, autoRefreshInterval);
  applySectionVisibility({ showDailyChart, showExtraBars, showFooter, showAccountBar: showAccBar });
  (document.getElementById('row-reset-threshold') as HTMLElement).style.opacity = notifyOnReset ? '1' : '0.4';
  (document.getElementById('row-auto-backup-folder') as HTMLElement).style.display =
    autoBackupMode === 'never' ? 'none' : '';

  // Smart Plan
  const spEnabled = (document.getElementById('sp-enabled') as HTMLInputElement).checked;
  const spActiveDays = [0,1,2,3,4,5,6].filter(d => {
    const cb = document.getElementById(`sp-day-${d}`) as HTMLInputElement;
    return cb?.checked;
  });
  const spWorkStart = (document.getElementById('sp-work-start') as HTMLInputElement).value;
  const spWorkEnd = (document.getElementById('sp-work-end') as HTMLInputElement).value;
  const spBreakStart = (document.getElementById('sp-break-start') as HTMLInputElement).value;
  const spBreakEnd = (document.getElementById('sp-break-end') as HTMLInputElement).value;
  const errEl = document.getElementById('sp-validation-error') as HTMLElement;

  const toMin = (tv: string) => { const [h,m] = tv.split(':').map(Number); return h*60+m; };
  const valid = spWorkStart && spWorkEnd && spBreakStart && spBreakEnd &&
    toMin(spWorkStart) < toMin(spBreakStart) &&
    toMin(spBreakEnd) <= toMin(spWorkEnd) &&
    toMin(spWorkStart) < toMin(spWorkEnd) &&
    toMin(spBreakStart) < toMin(spBreakEnd);

  if (!valid) {
    errEl.classList.remove('hidden');
    return;
  }
  errEl.classList.add('hidden');

  await window.claudeUsage.saveSettings({
    launchAtStartup: startup,
    alwaysVisible,
    theme,
    language: lang,
    windowSize,
    autoRefresh,
    autoRefreshInterval,
    autoBackupMode,
    showDailyChart,
    showExtraBars,
    showFooter,
    showAccountBar: showAccBar,
    compactMode,
    workSchedule: {
      enabled: spEnabled,
      activeDays: spActiveDays,
      workStart: spWorkStart,
      workEnd: spWorkEnd,
      breakStart: spBreakStart,
      breakEnd: spBreakEnd,
    },
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

let spDonutChart: Chart | null = null;

function formatMinutes(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function openSmartModal(): void {
  const s = currentSmartStatus;
  if (!s) return;
  
  // Aplicar traduções primeiro
  applyTranslations();
  
  const modal = document.getElementById('smart-scheduler-modal')!;
  const t = translations[currentLang] as Record<string, string>;

  // Header
  const header = document.getElementById('sp-verdict-header')!;
  header.style.backgroundColor = s.colorHex;
  const verdictText = (t[s.messageKey] ?? s.messageKey).replace('{time}', s.idealStartTime ?? '');
  (document.getElementById('sp-verdict-text') as HTMLElement).textContent = verdictText;

  // Donut
  if (spDonutChart) { spDonutChart.destroy(); spDonutChart = null; }
  const canvas = document.getElementById('sp-donut') as HTMLCanvasElement;
  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#444';
  const pct = Math.min(Math.round(s.usoSessao), 100);
  (document.getElementById('sp-donut-pct') as HTMLElement).textContent = String(pct);
  spDonutChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [pct, Math.max(0, 100 - pct)],
        backgroundColor: [s.colorHex, borderColor],
        borderWidth: 0,
      }],
    },
    options: {
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: false,
    },
  });

  // Timeline — Dynamic Bounds
const timelineStartMin = Math.min(s.workStartMin, s.minutosAtuais, s.workEndMin);
  const timelineEndMin = Math.max(
    s.workEndMin,
    s.minutosAtuais,
    s.resetCrossesDay ? s.workEndMin : Math.min(s.momentoDoReset, 24 * 60)
  );
  const totalRange = timelineEndMin - timelineStartMin;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const pctOf = (min: number) => clamp((min - timelineStartMin) / totalRange * 100, 0, 100);

  const workBlock = document.getElementById('sp-work-block') as HTMLElement;
  workBlock.style.left = `${pctOf(s.workStartMin)}%`;
  workBlock.style.width = `${pctOf(s.workEndMin) - pctOf(s.workStartMin)}%`;

  (document.getElementById('sp-work-start-tick') as HTMLElement).style.left = `${pctOf(s.workStartMin)}%`;
  (document.getElementById('sp-work-end-tick') as HTMLElement).style.left = `${pctOf(s.workEndMin)}%`;

  const breakBlock = document.getElementById('sp-break-block') as HTMLElement;
  breakBlock.style.left = `${pctOf(s.breakStartMin)}%`;
  breakBlock.style.width = `${pctOf(s.breakEndMin) - pctOf(s.breakStartMin)}%`;

  const nowMarker = document.getElementById('sp-now-marker') as HTMLElement;
  nowMarker.style.left = `${pctOf(s.minutosAtuais)}%`;
  const nowLabel = document.getElementById('sp-now-label') as HTMLElement;
  nowLabel.style.left = `${pctOf(s.minutosAtuais)}%`;
  nowLabel.textContent = formatMinutes(s.minutosAtuais);

  const resetMarker = document.getElementById('sp-reset-marker') as HTMLElement;
  const resetLabel = document.getElementById('sp-reset-label') as HTMLElement;
  resetMarker.style.color = s.colorHex;
  if (s.resetCrossesDay) {
    const crossDayHHMM = formatMinutes(s.momentoDoReset % (24 * 60));
    const labelTemplate = t['smartPlan.resetNextDay'] ?? '+1d {time}';
    const label = labelTemplate.replace('{time}', crossDayHHMM);
    resetMarker.style.left = '100%';
    resetMarker.title = label;
    resetLabel.textContent = label;
    resetLabel.style.left = '100%';
    resetLabel.style.transform = 'translateX(-100%)';
    resetLabel.style.top = '-14px'; // acima do track para não sobrepor nowLabel e tlEnd
    resetLabel.style.color = s.colorHex;
    resetLabel.style.display = 'block';
  } else {
    const resetHHMMInline = formatMinutes(s.momentoDoReset % (24 * 60));
    const resetPct  = pctOf(s.momentoDoReset);
    const endPct    = pctOf(s.workEndMin);
    const startPct  = pctOf(s.workStartMin);
    const nowPct    = pctOf(s.minutosAtuais);
    const PROXIMITY = 10; // % do range — threshold de colisão com outros marcadores

    const collidesWithOther =
      Math.abs(resetPct - endPct) < PROXIMITY ||
      Math.abs(resetPct - startPct) < PROXIMITY ||
      Math.abs(resetPct - nowPct) < PROXIMITY ||
      resetPct > 100 - PROXIMITY ||
      resetPct < PROXIMITY;

    resetMarker.style.left = `${resetPct}%`;
    resetMarker.title = resetHHMMInline;
    resetLabel.textContent = resetHHMMInline;
    resetLabel.style.left = `${resetPct}%`;
    // Se colidir: sobe o label para cima do track; senão: fica abaixo centralizado
    resetLabel.style.top = collidesWithOther ? '-14px' : '26px';
    resetLabel.style.transform = 'translateX(-50%)';
    resetLabel.style.color = s.colorHex;
    resetLabel.style.display = 'block';
  }

  const tlStart = document.getElementById('sp-timeline-start') as HTMLElement;
  tlStart.textContent = formatMinutes(s.workStartMin);
  tlStart.style.left = `${pctOf(s.workStartMin)}%`;

  const tlEnd = document.getElementById('sp-timeline-end') as HTMLElement;
  tlEnd.textContent = formatMinutes(s.workEndMin);
  tlEnd.style.left = `${pctOf(s.workEndMin)}%`;

  // Hide markers when too close to avoid overlap (gap < 10%)
  const gap = (a: number, b: number) => Math.abs(pctOf(a) - pctOf(b));
  tlEnd.style.visibility = gap(s.workEndMin, s.minutosAtuais) < 10 ? 'hidden' : '';
  tlStart.style.visibility = gap(s.workStartMin, s.minutosAtuais) < 10 ? 'hidden' : '';

  // Summary sentence
  const resetHHMM = formatMinutes(s.momentoDoReset % (24 * 60));
  const minBeforeEnd = s.workEndMin - s.momentoDoReset;
  let summary: string;
  if (s.resetCrossesDay) {
    summary = `${t['spSummaryResetAt'] ?? 'Sessão reinicia às'} ${resetHHMM} (+1d) — ${t['spSummaryAfterWork'] ?? 'após o fim do expediente'}`;
  } else if (minBeforeEnd > 0) {
    summary = `${t['spSummaryResetAt'] ?? 'Sessão reinicia às'} ${resetHHMM} · ${minBeforeEnd}min ${t['spSummaryBeforeEnd'] ?? 'antes do fim do expediente'}`;
  } else {
    summary = `${t['spSummaryResetAt'] ?? 'Sessão reinicia às'} ${resetHHMM}`;
  }
  (document.getElementById('sp-summary-text') as HTMLElement).textContent = summary;

  // Legend reset icon color
  const legendReset = document.getElementById('sp-legend-reset-icon') as HTMLElement | null;
  if (legendReset) legendReset.style.color = s.colorHex;

  modal.classList.remove('hidden');

  // Resize popup to fit modal content
  requestAnimationFrame(() => {
    const box = modal.querySelector('.modal-box') as HTMLElement;
    const hdr = document.querySelector('.header') as HTMLElement;
    if (box && hdr) {
      const h = hdr.offsetHeight + box.offsetHeight + 48;
      window.claudeUsage.setWindowHeight(h);
    }
  });

  const closeModal = () => {
    modal.classList.add('hidden');
    fitWindow();
  };

  // Close handlers
  document.getElementById('sp-close-btn')?.addEventListener('click', closeModal, { once: true });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  }, { once: true });
}

function applySmartIndicator(s: import('./globals').SmartStatus): void {
  const btn = document.getElementById('smart-indicator') as HTMLButtonElement | null;
  const recBar = document.getElementById('smart-rec-bar') as HTMLElement | null;
  if (!btn) return;
  if (!s.enabled) {
    btn.classList.add('hidden');
    if (recBar) recBar.classList.add('hidden');
    return;
  }
  btn.classList.remove('hidden');
  const dot = btn.querySelector('.smart-indicator-dot') as HTMLElement;
  if (dot) dot.style.background = s.colorHex;
  const t = tr() as Record<string, string>;
  const statusText = t[s.messageKey] ?? s.messageKey;
  const resolvedText = statusText.replace('{time}', s.idealStartTime ?? '');
  btn.title = resolvedText;
  if (recBar) {
    recBar.textContent = resolvedText;
    recBar.style.borderLeftColor = s.colorHex;
    recBar.classList.remove('hidden');
  }
}

function applyTheme(theme: AppSettings['theme']): void {
  const el = document.documentElement;
  if (theme === 'system') {
    el.removeAttribute('data-theme');
  } else {
    el.setAttribute('data-theme', theme);
  }
}

function applySectionVisibility(s: Pick<AppSettings, 'showDailyChart' | 'showExtraBars' | 'showFooter' | 'showAccountBar'>): void {
  const historySection = document.getElementById('history-section') as HTMLElement;
  const extraSection   = document.getElementById('extra-section') as HTMLElement;
  const footer         = document.querySelector('.footer') as HTMLElement;
  const accountBar     = document.getElementById('account-bar') as HTMLElement;

  if (historySection) historySection.style.display = s.showDailyChart ? '' : 'none';
  if (extraSection)   extraSectionAllowed = s.showExtraBars ?? true;
  if (!s.showExtraBars && extraSection) extraSection.style.display = 'none';
  if (footer)         footer.style.display         = s.showFooter     ? '' : 'none';
  // account bar: only show if both setting and data are present
  const hasAccount = accountBar && accountBar.dataset.hasProfile === 'true';
  if (accountBar) accountBar.style.display = (s.showAccountBar && hasAccount) ? '' : 'none';

  fitWindow();
}

// ── Force refresh modal ───────────────────────────────────────────────────────

function showForceRefreshModal(): void {
  document.getElementById('force-refresh-modal')!.classList.remove('hidden');
}

// ── Cloud Sync UI ─────────────────────────────────────────────────────────────

function formatRelativeTime(ts: number): string {
  const t = tr();
  if (!ts) return t.syncNever;
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t.syncJustNow;
  if (mins < 60) return t.syncMinAgo(mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t.syncHAgo(hrs);
  return t.syncDAgo(Math.floor(hrs / 24));
}

function applyCloudSyncStatus(status: {
  enabled: boolean;
  lastSyncAt: number;
  lastError: string;
  pendingOps: number;
  jwtExpiresAt: number;
  email: string;
}): void {
  const setup  = document.getElementById('cloud-sync-setup')  as HTMLElement;
  const panel  = document.getElementById('cloud-sync-status') as HTMLElement;

  if (!status.enabled) {
    setup.style.display  = '';
    panel.style.display  = 'none';
    syncLastKnownStatus = status;
    updateSyncHeaderIcon(status, getSettings_cache?.cloudSync?.serverUrl);
    return;
  }

  const t = tr();

  setup.style.display  = 'none';
  panel.style.display  = '';

  const emailEl   = document.getElementById('sync-status-email')   as HTMLElement;
  const serverEl  = document.getElementById('sync-status-server')  as HTMLElement;
  const lastEl    = document.getElementById('sync-status-last')    as HTMLElement;
  const nextEl    = document.getElementById('sync-status-next')    as HTMLElement;
  const stateEl   = document.getElementById('sync-status-state')   as HTMLElement;

  const settings = getSettings_cache;
  const intervalMs = (settings?.cloudSync?.syncIntervalMinutes ?? 15) * 60 * 1000;
  const nextSyncAt = status.lastSyncAt ? status.lastSyncAt + intervalMs : 0;

  emailEl.textContent   = status.email || '—';
  const rawUrl = settings?.cloudSync?.serverUrl || '';
  serverEl.textContent = rawUrl ? (() => { try { return new URL(rawUrl).host; } catch { return rawUrl; } })() : '—';
  lastEl.textContent    = formatRelativeTime(status.lastSyncAt);
  if (nextSyncAt) {
    const diffNext = nextSyncAt - Date.now();
    if (diffNext <= 0) {
      nextEl.textContent = t.syncSoon;
    } else {
      const minsNext = Math.ceil(diffNext / 60000);
      nextEl.textContent = minsNext < 60 ? t.syncInMin(minsNext) : t.syncInH(Math.ceil(minsNext / 60));
    }
  } else {
    nextEl.textContent = '—';
  }

  if (status.lastError) {
    stateEl.textContent = status.lastError;
    stateEl.style.color = 'var(--accent-red)';
  } else if (status.pendingOps > 0) {
    stateEl.textContent = t.syncStateSyncing;
    stateEl.style.color = '#4a9eff';
  } else {
    stateEl.textContent = t.syncStateSynced;
    stateEl.style.color = 'var(--accent-green)';
  }

  syncLastKnownAt = status.lastSyncAt;
  syncLastKnownIntervalMs = (settings?.cloudSync?.syncIntervalMinutes ?? 15) * 60 * 1000;
  syncLastKnownStatus = status;

  updateSyncHeaderIcon(status, getSettings_cache?.cloudSync?.serverUrl);
  fitWindow();
}

// Cache local das settings para a seção de cloud sync (evita async em applyCloudSyncStatus)
let getSettings_cache: { cloudSync: { serverUrl: string; syncIntervalMinutes: number } } | null = null;
let syncLastKnownAt = 0;
let syncLastKnownIntervalMs = 15 * 60 * 1000;
let syncLastKnownStatus: { enabled: boolean; lastSyncAt: number; lastError: string; pendingOps: number } | null = null;

function updateSyncHeaderIcon(status: { enabled: boolean; lastSyncAt: number; lastError: string; pendingOps: number }, serverUrl?: string): void {
  const btn = document.getElementById('btn-cloud-sync') as HTMLButtonElement | null;
  if (!btn) return;

  if (!status.enabled) {
    btn.style.display = 'none';
    return;
  }

  btn.style.display = '';
  btn.classList.remove('sync-ok', 'sync-error', 'sync-syncing');

  if (status.lastError) {
    btn.classList.add('sync-error');
  } else if (status.pendingOps > 0) {
    btn.classList.add('sync-syncing');
  } else {
    btn.classList.add('sync-ok');
  }

  const t = tr();
  const host = serverUrl ? (() => { try { return new URL(serverUrl).hostname; } catch { return serverUrl; } })() : '';
  const lastStr = formatRelativeTime(syncLastKnownAt || status.lastSyncAt);

  const intervalMs = (getSettings_cache?.cloudSync?.syncIntervalMinutes ?? 15) * 60 * 1000;
  const nextSyncAt = status.lastSyncAt ? status.lastSyncAt + intervalMs : 0;
  let nextStr = '—';
  if (nextSyncAt) {
    const diff = nextSyncAt - Date.now();
    if (diff <= 0) nextStr = t.syncSoon;
    else {
      const mins = Math.ceil(diff / 60000);
      nextStr = mins < 60 ? t.syncInMin(mins) : t.syncInH(Math.ceil(mins / 60));
    }
  }

  const lines = ['Cloud Sync'];
  if (host) lines.push(`Servidor: ${host}`);
  lines.push(`Última sync: ${lastStr}`);
  if (!status.lastError) lines.push(`Próxima: ${nextStr}`);
  if (status.lastError) lines.push(`Erro: ${status.lastError}`);

  btn.title = lines.join('\n');
}

function refreshSyncTimes(): void {
  if (!syncLastKnownAt) return;

  const t = tr();
  const lastStr = formatRelativeTime(syncLastKnownAt);
  const nextSyncAt = syncLastKnownAt + syncLastKnownIntervalMs;
  const diff = nextSyncAt - Date.now();
  const nextStr = diff <= 0 ? t.syncSoon
    : Math.ceil(diff / 60000) < 60 ? t.syncInMin(Math.ceil(diff / 60000))
    : t.syncInH(Math.ceil(diff / 3600000));

  const lastEl = document.getElementById('sync-status-last') as HTMLElement | null;
  const nextEl = document.getElementById('sync-status-next') as HTMLElement | null;
  if (lastEl) lastEl.textContent = lastStr;
  if (nextEl) nextEl.textContent = nextStr;

  // Atualiza tooltip do ícone no header
  if (syncLastKnownStatus) {
    updateSyncHeaderIcon(syncLastKnownStatus, getSettings_cache?.cloudSync?.serverUrl);
  }
}

async function loadCloudSyncStatus(): Promise<void> {
  try {
    const s = await window.claudeUsage.getSettings();
    getSettings_cache = s as typeof getSettings_cache;
    const status = await window.claudeUsage.sync.getStatus();
    applyCloudSyncStatus(status);
    // Pre-fill server URL and device label if already set
    if (!status.enabled && s.cloudSync) {
      const urlEl   = document.getElementById('sync-server-url')   as HTMLInputElement;
      const labelEl = document.getElementById('sync-device-label') as HTMLInputElement;
      if (s.cloudSync.serverUrl && urlEl) urlEl.value = (s as AppSettings & { cloudSync: { serverUrl: string; deviceLabel: string } }).cloudSync.serverUrl;
      if ((s as AppSettings & { cloudSync: { deviceLabel: string } }).cloudSync.deviceLabel && labelEl) {
        labelEl.value = (s as AppSettings & { cloudSync: { deviceLabel: string } }).cloudSync.deviceLabel;
      }
    }
  } catch (_e) {
    // sync API not available — hide the section gracefully
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init(): void {
  sessionChart = createGauge('gauge-session');
  weeklyChart  = createGauge('gauge-weekly');

  void loadSettings();

  function applyProfile(profile: ProfileData): void {
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

    bar.dataset.hasProfile = 'true';
    bar.style.display = showAccountBar ? 'flex' : 'none';
    fitWindow();
  }

  void window.claudeUsage.getProfile().then((profile) => {
    if (!profile) return;
    applyProfile(profile);
  });

  window.claudeUsage.onProfileUpdated((profile) => {
    applyProfile(profile);
  });

  void window.claudeUsage.getAppVersion().then((version) => {
    const el = document.getElementById('app-version');
    if (el) el.textContent = `v${version}`;
  });

  window.claudeUsage.onSmartStatusUpdated((status) => {
    currentSmartStatus = status;
    applySmartIndicator(status);
  });

  window.claudeUsage.onUsageUpdated((data) => {
    (document.getElementById('credential-modal') as HTMLElement).classList.add('hidden');
    updateUI(data);
    void updateBurnRate();
    void updateWeeklyBurnRate();
  });

  // Atualizar gráfico quando receber dados novos
  window.claudeUsage.onUsageUpdated(() => {
    if (lastWeeklyResetsAt) {
      void window.claudeUsage.getDailyHistory().then(d => {
        renderDailyChart(d, lastWeeklyResetsAt!, lastWeeklyPct ?? undefined, lastSessionPct ?? undefined);
      });
    }
  });

  document.getElementById('btn-report-history')!.addEventListener('click', () => void openReportModal());
  document.getElementById('btn-close-report')!.addEventListener('click', () => {
    document.getElementById('report-modal')!.classList.add('hidden');
  });

  document.getElementById('btn-clear-history')!.addEventListener('click', async () => {
    if (!confirm(tr().clearHistoryConfirm)) return;
    await window.claudeUsage.clearDailyHistory();
    if (lastWeeklyResetsAt) renderDailyChart([], lastWeeklyResetsAt);
  });

  document.getElementById('btn-backup-history')!.addEventListener('click', async () => {
    const filepath = await window.claudeUsage.backupWeeklyData();
    alert(tr().backupSuccess(filepath));
  });

  document.getElementById('btn-import-history')!.addEventListener('click', async () => {
    const { merged } = await window.claudeUsage.importBackup();
    if (merged === 0) return;
    alert(tr().importSuccess(merged));
    if (lastWeeklyResetsAt) {
      const updated = await window.claudeUsage.getDailyHistory();
      renderDailyChart(updated, lastWeeklyResetsAt);
    } else {
      // Ainda não recebemos dados do polling — dispara um refresh
      // para obter resets_at; onUsageUpdated vai renderizar o gráfico
      void window.claudeUsage.refreshNow();
    }
  });

  document.getElementById('btn-edit-history')!.addEventListener('click', async () => {
    const modal = document.getElementById('edit-snapshot-modal') as HTMLElement;
    const dateSelect = document.getElementById('edit-date-select') as HTMLSelectElement;

    const todayStr = new Date().toLocaleDateString('sv');
    const history = await window.claudeUsage.getDailyHistory();
    const dates = [...new Set([...history.map(d => d.date), todayStr])].sort().reverse();
    dateSelect.innerHTML = dates.map(d => `<option value="${d}">${d}</option>`).join('');

    function populateFields(dateStr: string): void {
      const found = history.find(d => d.date === dateStr);
      (document.getElementById('edit-maxSession') as HTMLInputElement).value = String(found?.maxSession ?? 0);
      (document.getElementById('edit-sessionAccum') as HTMLInputElement).value = String(found?.sessionAccum ?? 0);
      (document.getElementById('edit-sessionWindowCount') as HTMLInputElement).value = String(Math.max(0, (found?.sessionWindowCount ?? 1) - 1));
      (document.getElementById('edit-maxWeekly') as HTMLInputElement).value = String(found?.maxWeekly ?? 0);
    }

    populateFields(dateSelect.value);
    dateSelect.onchange = () => populateFields(dateSelect.value);

    modal.classList.remove('hidden');
  });

  document.getElementById('edit-snapshot-cancel')!.addEventListener('click', () => {
    (document.getElementById('edit-snapshot-modal') as HTMLElement).classList.add('hidden');
  });

  document.getElementById('edit-snapshot-save')!.addEventListener('click', async () => {
    const dateSelect = document.getElementById('edit-date-select') as HTMLSelectElement;
    const snapshot = {
      date: dateSelect.value,
      maxSession: parseInt((document.getElementById('edit-maxSession') as HTMLInputElement).value, 10) || 0,
      sessionAccum: parseInt((document.getElementById('edit-sessionAccum') as HTMLInputElement).value, 10) || 0,
      // convert back: user inputs resets count, store as windows count (resets + 1)
      sessionWindowCount: (parseInt((document.getElementById('edit-sessionWindowCount') as HTMLInputElement).value, 10) || 0) + 1,
      maxWeekly: parseInt((document.getElementById('edit-maxWeekly') as HTMLInputElement).value, 10) || 0,
    };
    await window.claudeUsage.updateDailySnapshot(snapshot);
    const updated = await window.claudeUsage.getDailyHistory();
    if (lastWeeklyResetsAt) renderDailyChart(updated, lastWeeklyResetsAt);
    (document.getElementById('edit-snapshot-modal') as HTMLElement).classList.add('hidden');
  });

  // Day detail modal — close handlers
  function closeDayDetailModal() {
    document.getElementById('day-detail-modal')!.classList.add('hidden');
    if (dayDetailChart) { dayDetailChart.destroy(); dayDetailChart = null; }
  }
  document.getElementById('day-detail-close')!.addEventListener('click', closeDayDetailModal);
  document.getElementById('day-detail-modal')!.addEventListener('click', (e) => {
    if (e.target === document.getElementById('day-detail-modal')) closeDayDetailModal();
  });

  // Fecha modais abertos quando a janela é reexibida (popup hide → show não recria o DOM)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      document.querySelectorAll<HTMLElement>('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
    }
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

  window.claudeUsage.onLastResponse((info) => {
    const el = document.getElementById('last-resp-text') as HTMLElement;
    const time = new Date(info.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (info.ok) {
      el.textContent = tr().lastRespOk(time);
      el.className = 'last-resp-text ok';
    } else {
      const detail = info.code ? String(info.code) : (info.message ?? 'Error');
      el.textContent = tr().lastRespErr(detail, time);
      el.className = 'last-resp-text err';
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

window.claudeUsage.onCredentialsExpired(() => {
    const t = tr();
    (document.getElementById('credential-path-value') as HTMLElement).textContent = t.credentialExpired ?? 'Token expired. Please log in again.';
    const winStep = document.getElementById('install-step-win') as HTMLElement;
    const linuxStep = document.getElementById('install-step-linux') as HTMLElement;
    if (winStep) winStep.style.display = 'none';
    if (linuxStep) linuxStep.style.display = 'none';
    (document.getElementById('credential-modal') as HTMLElement).classList.remove('hidden');
  });

  document.getElementById('credential-retry-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('credential-retry-btn') as HTMLButtonElement;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = tr().retryingText;
    try {
      await window.claudeUsage.refreshNow();
    } catch {
      // Keep modal open on error (rate limit, etc)
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
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
    document.querySelectorAll<HTMLElement>('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
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
    const btn = document.getElementById('modal-confirm') as HTMLButtonElement;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = tr().forcingText;
    document.getElementById('force-refresh-modal')!.classList.add('hidden');
    (document.getElementById('updated-text') as HTMLElement).textContent = tr().refreshingText;
    void window.claudeUsage.forceRefreshNow().finally(() => {
      btn.disabled = false;
      btn.textContent = originalText;
    });
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
    'setting-auto-backup-mode',
    'setting-show-daily-chart',
    'setting-show-extra-bars',
    'setting-show-footer',
    'setting-show-account-bar',
    'setting-compact-mode',
    'sp-enabled',
    'sp-day-0', 'sp-day-1', 'sp-day-2', 'sp-day-3', 'sp-day-4', 'sp-day-5', 'sp-day-6',
    'sp-work-start', 'sp-work-end',
    'sp-break-start', 'sp-break-end',
  ];
  for (const id of settingEls) {
    document.getElementById(id)!.addEventListener('change', () => void saveSettingsFromUI());
  }

  // Settings modal — abrir/fechar
  function openSettingsModal(): void {
    document.getElementById('settings-modal')!.classList.remove('hidden');
    void loadCloudSyncStatus();
  }

  function closeSettingsModal(): void {
    document.getElementById('settings-modal')!.classList.add('hidden');
  }

  document.getElementById('smart-indicator')?.addEventListener('click', openSmartModal);
  document.getElementById('btn-settings')!.addEventListener('click', openSettingsModal);

  // Language change handler - apply translations immediately
  document.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'setting-language') {
      const newLang = (target as HTMLSelectElement).value as Lang;
      currentLang = newLang;
      applyTranslations();
      // Update gauge labels directly after translation
      setTimeout(() => {
        const labels = document.getElementsByClassName('gauge-label');
        const t2 = tr();
        if (labels[0]) labels[0].textContent = t2.sessionLabel;
        if (labels[1]) labels[1].textContent = t2.weeklyLabel;
      }, 0);
      // Re-render daily chart
      if (lastWeeklyResetsAt) {
        renderDailyChart(currentDailyHistory, lastWeeklyResetsAt, lastWeeklyPct ?? undefined, lastSessionPct ?? undefined);
      }
      // Update footer countdown
      if (nextPollAt > 0) {
        const remaining = nextPollAt - Date.now();
        if (remaining > 0) {
          const m = Math.floor(remaining / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          const el = document.getElementById('next-poll-text') as HTMLElement;
          if (el) el.textContent = tr().nextPollIn(`${m}:${String(s).padStart(2, '0')}`);
        }
      }
      // Update footer updated time
      if (lastUpdatedTime) {
        const el = document.getElementById('updated-text') as HTMLElement;
        if (el) el.textContent = tr().updatedAt(lastUpdatedTime);
      }
    }
  });
  document.getElementById('btn-settings-close')!.addEventListener('click', closeSettingsModal);
  document.getElementById('settings-modal')!.addEventListener('click', (e) => {
    if (e.target === document.getElementById('settings-modal')) closeSettingsModal();
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = (btn as HTMLElement).dataset.tab!;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(tabId)!.classList.remove('hidden');
    });
  });

  document.getElementById('btn-test-notif')!.addEventListener('click', () => {
    void window.claudeUsage.testNotification();
  });

  document.getElementById('btn-auto-backup-folder')!.addEventListener('click', async () => {
    const folder = await window.claudeUsage.chooseAutoBackupFolder();
    if (folder) {
      await window.claudeUsage.saveSettings({ autoBackupFolder: folder });
      const lbl = document.getElementById('lbl-auto-backup-folder');
      if (lbl) lbl.textContent = folder;
      fitWindow();
    }
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

  // ── Cloud Sync event listeners ──────────────────────────────────────────────

  document.getElementById('btn-sync-enable')!.addEventListener('click', async () => {
    const urlEl   = document.getElementById('sync-server-url')   as HTMLInputElement;
    const labelEl = document.getElementById('sync-device-label') as HTMLInputElement;
    const errEl   = document.getElementById('sync-setup-error')  as HTMLElement;
    const btn     = document.getElementById('btn-sync-enable')   as HTMLButtonElement;

    errEl.style.display = 'none';
    errEl.textContent   = '';
    btn.disabled = true;
    btn.textContent = 'Connecting...';

    try {
      await window.claudeUsage.sync.enable(urlEl.value.trim(), labelEl.value.trim() || undefined);
      getSettings_cache = await window.claudeUsage.getSettings() as typeof getSettings_cache;
      const status = await window.claudeUsage.sync.getStatus();
      applyCloudSyncStatus(status);
    } catch (e) {
      errEl.textContent   = e instanceof Error ? e.message : String(e);
      errEl.style.display = '';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in & enable';
    }
  });

  document.getElementById('btn-sync-now')!.addEventListener('click', async () => {
    const btn   = document.getElementById('btn-sync-now')      as HTMLButtonElement;
    const errEl = document.getElementById('sync-enabled-error') as HTMLElement;
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = tr().syncSyncingBtn;
    try {
      await window.claudeUsage.sync.triggerNow();
      const status = await window.claudeUsage.sync.getStatus();
      applyCloudSyncStatus(status);
    } catch (e) {
      errEl.textContent   = e instanceof Error ? e.message : String(e);
      errEl.style.display = '';
    } finally {
      btn.disabled = false;
      btn.textContent = tr().syncNowBtn;
    }
  });

  document.getElementById('btn-sync-disable')!.addEventListener('click', async () => {
    const errEl = document.getElementById('sync-enabled-error') as HTMLElement;
    errEl.style.display = 'none';
    try {
      await window.claudeUsage.sync.disable(false);
      getSettings_cache = await window.claudeUsage.getSettings() as typeof getSettings_cache;
      const status = await window.claudeUsage.sync.getStatus();
      applyCloudSyncStatus(status);
    } catch (e) {
      errEl.textContent   = e instanceof Error ? e.message : String(e);
      errEl.style.display = '';
    }
  });

  document.getElementById('btn-sync-wipe')!.addEventListener('click', async () => {
    if (!confirm('This will permanently delete all your data from the sync server. Are you sure?')) return;
    const errEl = document.getElementById('sync-enabled-error') as HTMLElement;
    errEl.style.display = 'none';
    try {
      await window.claudeUsage.sync.disable(true);
      getSettings_cache = await window.claudeUsage.getSettings() as typeof getSettings_cache;
      const status = await window.claudeUsage.sync.getStatus();
      applyCloudSyncStatus(status);
    } catch (e) {
      errEl.textContent   = e instanceof Error ? e.message : String(e);
      errEl.style.display = '';
    }
  });

  // Escuta eventos em tempo real do syncService
  window.claudeUsage.sync.onEvent(async (data) => {
    if (['sync-started', 'sync-success', 'sync-error', 'sync-enabled', 'sync-disabled', 'enabled', 'disabled'].includes(data.type)) {
      const status = await window.claudeUsage.sync.getStatus();
      applyCloudSyncStatus(status);
    }
  });

  // Cost modal
  function openCostModal(): void {
    document.getElementById('cost-modal')!.classList.remove('hidden');
    initCostGauge();
    loadCostData();
  }

  function closeCostModal(): void {
    document.getElementById('cost-modal')!.classList.add('hidden');
  }

  async function loadCostData(): Promise<void> {
    const cost = await window.claudeUsage.getCostEstimate();
    if (!cost) return;

    document.getElementById('cost-session-value')!.textContent = `$${cost.session.total.toFixed(2)}`;
    document.getElementById('cost-session-input')!.textContent = `$${cost.session.input.toFixed(2)}`;
    document.getElementById('cost-session-output')!.textContent = `$${cost.session.output.toFixed(2)}`;

    document.getElementById('cost-weekly-value')!.textContent = `$${cost.weekly.total.toFixed(2)}`;
    document.getElementById('cost-weekly-input')!.textContent = `$${cost.weekly.input.toFixed(2)}`;
    document.getElementById('cost-weekly-output')!.textContent = `$${cost.weekly.output.toFixed(2)}`;

    document.getElementById('cost-monthly-value')!.textContent = `$${cost.monthly.total.toFixed(2)}`;
    document.getElementById('cost-monthly-input')!.textContent = `$${cost.monthly.input.toFixed(2)}`;
    document.getElementById('cost-monthly-output')!.textContent = `$${cost.monthly.output.toFixed(2)}`;
    document.getElementById('cost-budget-value')!.textContent = `$${cost.budget.toFixed(2)}`;
    document.getElementById('cost-monthly-pct')!.textContent = String(cost.budgetPercentage);
    document.getElementById('cost-budget-input')!.value = String(cost.budget);

    if (costGaugeChart) {
      updateGauge(costGaugeChart, cost.budgetPercentage);
    }
  }

  function initCostGauge(): void {
    if (costGaugeChart) return;
    costGaugeChart = createGauge('cost-gauge');
  }

  document.getElementById('btn-update-header')!.addEventListener('click', () => {
    void window.claudeUsage.checkForUpdate();
  });

  document.getElementById('btn-cost')!.addEventListener('click', openCostModal);
  document.getElementById('cost-modal-close')!.addEventListener('click', closeCostModal);
  document.getElementById('cost-modal')!.addEventListener('click', (e) => {
    if (e.target === document.getElementById('cost-modal')) closeCostModal();
  });

  document.querySelectorAll<HTMLElement>('.cost-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = (btn as HTMLElement).dataset.costTab!;
      document.querySelectorAll('.cost-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.cost-pane').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(`cost-${tabId}`)!.classList.remove('hidden');
    });
  });

  document.getElementById('cost-budget-input')!.addEventListener('change', async (e) => {
    const budget = Math.max(1, Math.min(1000, Number((e.target as HTMLInputElement).value)));
    await window.claudeUsage.saveSettings({ monthlyBudget: budget });
    loadCostData();
  });
}

document.addEventListener('DOMContentLoaded', init);
