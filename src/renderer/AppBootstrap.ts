import { tr, getLang, setLang, applyTranslations } from '../presentation/layouts/i18n';
import type { Lang } from '../presentation/layouts/i18n';
import { fitWindow, applySize, applySectionVisibility, applyTheme } from '../presentation/layouts/PopupLayout';
import { showConfirm, showInfo, showForceRefreshModal } from '../presentation/components/modals/GenericModals';
import { CloudSyncPanel } from '../presentation/components/sync/CloudSyncPanel';
import { setupTabSwitcher } from '../presentation/components/settings/SettingsLayout';
import { loadCostData, initCostGauge } from './CostModal';
import { applySmartIndicator, setCurrentSmartStatus, openSmartModal } from './SmartPlanModal';
import { sessionGauge, weeklyGauge, trayIcon, dailyChart, burnRate, costGauge } from './chartsInstance';
import { formatResetsIn, formatResetAt } from '../presentation/shared/formatters';
import { openReportModal } from './ReportModal';
import { openDayDetailModal, closeDayDetailModal } from './DayDetailModal';

let isRateLimited = false;
let autoRefreshEnabled = false;
let nextPollTimer: ReturnType<typeof setInterval> | null = null;
let nextPollAt = 0;
let countdownTimer: ReturnType<typeof setInterval> | null = null;

let lastWeeklyResetsAt: string | null = null;
let lastWeeklyPct: number | null = null;
let lastSessionPct: number | null = null;
let lastUpdatedTime: string | null = null;
let currentSmartStatus: import('../globals').SmartStatus | null = null;

const cloudSyncPanel = new CloudSyncPanel();

export async function bootstrap(): Promise<void> {
  sessionGauge.mount();
  weeklyGauge.mount();

  setupCloudSync();
  setupUpdateHandlers();
  setupHeaderHandlers();
  setupServerStatus();
  setupModalClosers();
  setupVisibilityHandler();
  setupThemeHandler();

  window.claudeUsage.onProfileUpdated((profile) => {
    applyProfile(profile);
  });

  window.claudeUsage.getAppVersion().then((version) => {
    const el = document.getElementById('app-version');
    if (el) el.textContent = `v${version}`;
  });

  window.claudeUsage.onSmartStatusUpdated((status) => {
    currentSmartStatus = status;
    setCurrentSmartStatus(status);
    applySmartIndicator(status);
  });

  window.claudeUsage.onUsageUpdated((data) => {
    (document.getElementById('credential-modal') as HTMLElement).classList.add('hidden');
    updateUI(data);
    void burnRate.updateSession();
    void burnRate.updateWeekly();
  });

  window.claudeUsage.onUsageUpdated(() => {
    if (lastWeeklyResetsAt) {
      window.claudeUsage.getDailyHistory().then(d => {
        dailyChart.render(d, lastWeeklyResetsAt!);
      });
    }
  });

  window.claudeUsage.onRateLimited((until, resetAt) => {
    isRateLimited = true;
    startRateLimitCountdown(until, resetAt);
  });

  window.claudeUsage.onNextPollAt((next) => {
    if (autoRefreshEnabled) {
      const remaining = next - Date.now();
      if (remaining > 0) startNextPollCountdown(remaining);
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
    clearRateLimitBanner();
    const pathEl = document.getElementById('credential-path-value') as HTMLElement;
    if (pathEl) pathEl.textContent = credPath;
    const isLinux = credPath.startsWith('/');
    (document.getElementById('install-step-win') as HTMLElement).style.display = isLinux ? 'none' : '';
    (document.getElementById('install-step-linux') as HTMLElement).style.display = isLinux ? '' : 'none';
    (document.getElementById('credential-modal') as HTMLElement).classList.remove('hidden');
    setTimeout(() => fitWindow(), 50);
  });

  window.claudeUsage.onCredentialsExpired(() => {
    clearRateLimitBanner();
    const pathEl = document.getElementById('credential-path-value') as HTMLElement;
    if (pathEl) pathEl.textContent = tr().credentialExpired ?? 'Token expired.';
    (document.getElementById('install-step-win') as HTMLElement).style.display = 'none';
    (document.getElementById('install-step-linux') as HTMLElement).style.display = 'none';
    (document.getElementById('credential-modal') as HTMLElement).classList.remove('hidden');
    setTimeout(() => fitWindow(), 50);
  });

  setupCredentialForm();
  setupHistoryHandlers();
  setupReportHandlers();
  setupEditSnapshotHandlers();
  setupSettingsHandlers();
  setupTabSwitcher();

  await loadSettings();
}

function setupCloudSync(): void {
  document.getElementById('btn-sync-enable')?.addEventListener('click', async () => {
    const urlEl = document.getElementById('sync-server-url') as HTMLInputElement;
    const labelEl = document.getElementById('sync-device-label') as HTMLInputElement;
    const errEl = document.getElementById('sync-setup-error') as HTMLElement;
    const btn = document.getElementById('btn-sync-enable') as HTMLButtonElement;
    errEl.style.display = 'none';
    errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Connecting...';
    try {
      await window.claudeUsage.sync.enable(urlEl.value.trim(), labelEl.value.trim() || undefined);
      const status = await window.claudeUsage.sync.getStatus();
      cloudSyncPanel.applyCloudSyncStatus(status);
    } catch (e) {
      errEl.textContent = e instanceof Error ? e.message : String(e);
      errEl.style.display = '';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in & enable';
    }
  });

  document.getElementById('btn-sync-now')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-now') as HTMLButtonElement;
    const errEl = document.getElementById('sync-enabled-error') as HTMLElement;
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = tr().syncSyncingBtn;
    try {
      await window.claudeUsage.sync.triggerNow();
      const status = await window.claudeUsage.sync.getStatus();
      cloudSyncPanel.applyCloudSyncStatus(status);
    } catch (e) {
      errEl.textContent = e instanceof Error ? e.message : String(e);
      errEl.style.display = '';
    } finally {
      btn.disabled = false;
      btn.textContent = tr().syncNowBtn;
    }
  });

  document.getElementById('btn-sync-disable')?.addEventListener('click', async () => {
    const errEl = document.getElementById('sync-enabled-error') as HTMLElement;
    errEl.style.display = 'none';
    try {
      await window.claudeUsage.sync.disable(false);
      const status = await window.claudeUsage.sync.getStatus();
      cloudSyncPanel.applyCloudSyncStatus(status);
    } catch (e) {
      errEl.textContent = e instanceof Error ? e.message : String(e);
      errEl.style.display = '';
    }
  });

  document.getElementById('btn-sync-wipe')?.addEventListener('click', async () => {
    if (!confirm('Delete all remote data?')) return;
    const errEl = document.getElementById('sync-enabled-error') as HTMLElement;
    errEl.style.display = 'none';
    try {
      await window.claudeUsage.sync.disable(true);
      const status = await window.claudeUsage.sync.getStatus();
      cloudSyncPanel.applyCloudSyncStatus(status);
    } catch (e) {
      errEl.textContent = e instanceof Error ? e.message : String(e);
      errEl.style.display = '';
    }
  });

  window.claudeUsage.sync.onEvent(async (data) => {
    if (['sync-started', 'sync-success', 'sync-error', 'sync-enabled', 'sync-disabled', 'enabled', 'disabled'].includes(data.type)) {
      const status = await window.claudeUsage.sync.getStatus();
      cloudSyncPanel.applyCloudSyncStatus(status);
    }
  });
}

function setupUpdateHandlers(): void {
  window.claudeUsage.onUpdateAvailable(({ version, url, downloadUrl, isMajor }) => {
    const banner = document.getElementById('update-banner') as HTMLElement;
    const label = document.getElementById('update-version-label') as HTMLElement;
    if (banner && label) {
      label.textContent = `v${version} disponível`;
      banner.style.display = 'flex';
      (banner as HTMLElement & { dataset: { url?: string; downloadUrl?: string } }).dataset.url = url;
      (banner as HTMLElement & { dataset: { url?: string; downloadUrl?: string } }).dataset.downloadUrl = downloadUrl;
      fitWindow();
    }
    if (isMajor) {
      const modal = document.getElementById('update-major-modal') as HTMLElement;
      const desc = document.getElementById('update-major-modal-desc') as HTMLElement;
      const btn = document.getElementById('update-major-download-btn') as HTMLButtonElement;
      if (modal && desc) {
        desc.textContent = `A versão v${version} inclui mudanças importantes.`;
        if (btn) btn.textContent = `Baixar v${version}`;
        modal.classList.remove('hidden');
      }
    }
  });

  document.getElementById('btn-update-download')?.addEventListener('click', () => {
    const banner = document.getElementById('update-banner') as HTMLElement & { dataset?: { downloadUrl?: string; url?: string } };
    const downloadUrl = banner?.dataset?.downloadUrl;
    const releaseUrl = banner?.dataset?.url;
    if (downloadUrl) void window.claudeUsage.downloadUpdate();
    else if (releaseUrl) window.claudeUsage.openReleaseUrl(releaseUrl);
  });

  window.claudeUsage.onUpdateDownloadProgress((pct) => {
    const fill = document.getElementById('update-major-progress-fill') as HTMLElement;
    const labelEl = document.getElementById('update-major-progress-label') as HTMLElement;
    if (fill) fill.style.width = `${pct}%`;
    if (labelEl) labelEl.textContent = `${Math.round(pct)}%`;
  });
}

function setupServerStatus(): void {
  const serverStatusDot = document.getElementById('server-status-dot') as HTMLElement;
  const serverStatusBtn = document.getElementById('btn-server-status') as HTMLElement;
  const onlineUsersBtn = document.getElementById('btn-online-users') as HTMLElement;
  const onlineUsersCount = document.getElementById('online-users-count') as HTMLElement;

  if (serverStatusBtn) serverStatusBtn.style.display = '';
  if (onlineUsersBtn) onlineUsersBtn.style.display = '';

  const updateServerStatusUI = (status: string): void => {
    if (!serverStatusDot || !serverStatusBtn) return;
    const cssStatus = status === 'connected' ? 'online' : status === 'disconnected' ? 'disconnected' : status;
    serverStatusDot.className = 'server-status-dot server-status-' + cssStatus;
    const t = tr();
    const labels: Record<string, string> = {
      connected: t.serverStatusOnline,
      disconnected: t.serverStatusOffline,
      connecting: t.serverStatusConnecting,
      error: t.serverStatusError,
    };
    serverStatusBtn.title = labels[status] ?? status;
  };

  window.claudeUsage.server.onStatusChange((event) => updateServerStatusUI(event.status));
  void window.claudeUsage.server.getStatus().then((status) => updateServerStatusUI(status));

  window.claudeUsage.server.onClientCountChange((count) => {
    if (onlineUsersCount) onlineUsersCount.textContent = count > 0 ? String(count) : '—';
  });
  void window.claudeUsage.server.getClientCount().then((count) => {
    if (onlineUsersCount) onlineUsersCount.textContent = count > 0 ? String(count) : '—';
  });
}

function setupHeaderHandlers(): void {
  document.getElementById('btn-close')?.addEventListener('click', () => {
    document.querySelectorAll<HTMLElement>('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
    window.claudeUsage.closeWindow();
  });

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    if (isRateLimited) {
      showForceRefreshModal();
      return;
    }
    void window.claudeUsage.refreshNow();
    (document.getElementById('updated-text') as HTMLElement).textContent = tr().refreshingText;
  });

  document.getElementById('modal-cancel')?.addEventListener('click', () => {
    document.getElementById('force-refresh-modal')?.classList.add('hidden');
  });

  document.getElementById('modal-confirm')?.addEventListener('click', () => {
    const btn = document.getElementById('modal-confirm') as HTMLButtonElement;
    const originalText = btn.textContent ?? '';
    btn.disabled = true;
    btn.textContent = tr().forcingText;
    document.getElementById('force-refresh-modal')?.classList.add('hidden');
    clearRateLimitBanner();
    (document.getElementById('updated-text') as HTMLElement).textContent = tr().refreshingText;
    void window.claudeUsage.forceRefreshNow().finally(() => {
      btn.disabled = false;
      btn.textContent = originalText;
    });
  });

  document.getElementById('btn-update-header')?.addEventListener('click', () => void window.claudeUsage.checkForUpdate());

  document.getElementById('btn-settings')?.addEventListener('click', () => {
    document.getElementById('settings-modal')?.classList.remove('hidden');
    loadCloudSyncStatus();
  });
  document.getElementById('btn-settings-close')?.addEventListener('click', () => {
    document.getElementById('settings-modal')?.classList.add('hidden');
  });
  document.getElementById('settings-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('settings-modal')) {
      document.getElementById('settings-modal')?.classList.add('hidden');
    }
  });

  document.getElementById('btn-cost')?.addEventListener('click', () => {
    document.getElementById('cost-modal')?.classList.remove('hidden');
    initCostGauge();
    loadCostData();
  });
  document.getElementById('cost-modal-close')?.addEventListener('click', () => {
    document.getElementById('cost-modal')?.classList.add('hidden');
  });
  document.getElementById('cost-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('cost-modal')) {
      document.getElementById('cost-modal')?.classList.add('hidden');
    }
  });

  document.querySelectorAll<HTMLElement>('.cost-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = (btn as HTMLElement).dataset.costTab!;
      document.querySelectorAll('.cost-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.cost-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`cost-${tabId}`)?.classList.add('active');
    });
  });

  document.getElementById('cost-budget-input')?.addEventListener('change', async (e) => {
    const budget = Math.max(1, Math.min(1000, Number((e.target as HTMLInputElement).value)));
    await window.claudeUsage.saveSettings({ monthlyBudget: budget });
    loadCostData();
  });

  document.querySelectorAll<HTMLElement>('.cost-model-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const model = btn.dataset.model as 'haiku' | 'sonnet' | 'opus';
      await window.claudeUsage.saveSettings({ costModel: model });
      loadCostData();
    });
  });
}

function setupCredentialForm(): void {
  const oauthLoginBtn = document.getElementById('oauth-login-btn') as HTMLButtonElement | null;
  const oauthLoginStatus = document.getElementById('oauth-login-status') as HTMLElement | null;

  if (oauthLoginBtn) {
    oauthLoginBtn.addEventListener('click', async () => {
      oauthLoginBtn.disabled = true;
      oauthLoginBtn.textContent = tr().credentialLoginWaiting;
      if (oauthLoginStatus) oauthLoginStatus.textContent = '';
      try {
        await window.claudeUsage.startOAuthLogin();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (oauthLoginStatus) oauthLoginStatus.textContent = `${tr().credentialLoginError}${message}`;
        oauthLoginBtn.disabled = false;
        oauthLoginBtn.textContent = tr().credentialLoginBrowserBtn;
      }
    });
  }

  window.claudeUsage.onOAuthLoginComplete(() => {
    if (oauthLoginStatus) oauthLoginStatus.textContent = tr().credentialLoginSuccess;
    (document.getElementById('credential-modal') as HTMLElement).classList.add('hidden');
    setTimeout(() => fitWindow(), 50);
  });

  window.claudeUsage.onOAuthLoginError((message: string) => {
    if (oauthLoginStatus) oauthLoginStatus.textContent = `${tr().credentialLoginError}${message}`;
    if (oauthLoginBtn) {
      oauthLoginBtn.disabled = false;
      oauthLoginBtn.textContent = tr().credentialLoginBrowserBtn;
    }
  });

  const saveManualCredsBtn = document.getElementById('save-manual-creds-btn');
  const manualCredsStatus = document.getElementById('manual-creds-status');
  if (saveManualCredsBtn) {
    saveManualCredsBtn.addEventListener('click', async () => {
      const accessToken = (document.getElementById('manual-access-token') as HTMLTextAreaElement)?.value?.trim();
      const refreshToken = (document.getElementById('manual-refresh-token') as HTMLTextAreaElement)?.value?.trim();
      if (!accessToken) {
        if (manualCredsStatus) manualCredsStatus.textContent = tr().credentialAccessTokenRequired;
        return;
      }
      try {
        if (manualCredsStatus) manualCredsStatus.textContent = tr().credentialSavingStatus;
        await window.claudeUsage.saveManualCredentials({ accessToken, refreshToken: refreshToken || undefined });
        if (manualCredsStatus) manualCredsStatus.textContent = tr().credentialSavedStatus;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (manualCredsStatus) manualCredsStatus.textContent = `${tr().errorPrefix}${message}`;
      }
    });
  }

  document.getElementById('credential-retry-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('credential-retry-btn') as HTMLButtonElement;
    const originalText = btn.textContent ?? '';
    btn.disabled = true;
    btn.textContent = tr().retryingText;
    try {
      await window.claudeUsage.forceRefreshNow();
    } catch {
      // Keep modal open
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

function setupHistoryHandlers(): void {
  document.getElementById('btn-clear-history')?.addEventListener('click', async () => {
    const t = tr();
    const ok = await showConfirm(t.clearHistoryConfirm, t.confirmClear, t.confirmCancel);
    if (!ok) return;
    await window.claudeUsage.clearDailyHistory();
    if (lastWeeklyResetsAt) dailyChart.render([], lastWeeklyResetsAt);
  });

  document.getElementById('btn-backup-history')?.addEventListener('click', async () => {
    const t = tr();
    const filepath = await window.claudeUsage.backupWeeklyData();
    await showInfo(t.backupSuccess(filepath), t.confirmOk);
  });

  document.getElementById('btn-import-history')?.addEventListener('click', async () => {
    const { merged } = await window.claudeUsage.importBackup();
    if (merged === 0) return;
    alert(tr().importSuccess(merged));
    if (lastWeeklyResetsAt) {
      const updated = await window.claudeUsage.getDailyHistory();
      dailyChart.render(updated, lastWeeklyResetsAt);
    } else {
      void window.claudeUsage.refreshNow();
    }
  });
}

function setupReportHandlers(): void {
  document.getElementById('btn-report-history')?.addEventListener('click', () => void openReportModal());
  document.getElementById('btn-close-report')?.addEventListener('click', () => {
    document.getElementById('report-modal')?.classList.add('hidden');
  });

  dailyChart.setDayClickHandler((date) => void openDayDetailModal(date));
}

function setupEditSnapshotHandlers(): void {
  document.getElementById('btn-edit-history')?.addEventListener('click', async () => {
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

  document.getElementById('edit-snapshot-cancel')?.addEventListener('click', () => {
    (document.getElementById('edit-snapshot-modal') as HTMLElement).classList.add('hidden');
  });

  document.getElementById('edit-snapshot-save')?.addEventListener('click', async () => {
    const dateSelect = document.getElementById('edit-date-select') as HTMLSelectElement;
    const snapshot = {
      date: dateSelect.value,
      maxSession: parseInt((document.getElementById('edit-maxSession') as HTMLInputElement).value, 10) || 0,
      sessionAccum: parseInt((document.getElementById('edit-sessionAccum') as HTMLInputElement).value, 10) || 0,
      sessionWindowCount: (parseInt((document.getElementById('edit-sessionWindowCount') as HTMLInputElement).value, 10) || 0) + 1,
      maxWeekly: parseInt((document.getElementById('edit-maxWeekly') as HTMLInputElement).value, 10) || 0,
    };
    await window.claudeUsage.updateDailySnapshot(snapshot);
    const updated = await window.claudeUsage.getDailyHistory();
    if (lastWeeklyResetsAt) dailyChart.render(updated, lastWeeklyResetsAt);
    (document.getElementById('edit-snapshot-modal') as HTMLElement).classList.add('hidden');
  });
}

function setupSettingsHandlers(): void {
  const settingEls = [
    'setting-startup', 'setting-always-visible',
    'setting-notif-enabled', 'setting-sound-enabled',
    'setting-notify-on-window-reset', 'setting-notify-on-reset',
    'setting-reset-threshold', 'setting-theme', 'setting-language',
    'setting-window-size', 'setting-auto-refresh',
    'setting-auto-refresh-interval', 'setting-session-threshold',
    'setting-weekly-threshold', 'setting-auto-backup-mode',
    'setting-show-daily-chart', 'setting-show-extra-bars',
    'setting-show-footer', 'setting-show-account-bar',
    'setting-compact-mode',
    'sp-enabled', 'sp-day-0', 'sp-day-1', 'sp-day-2', 'sp-day-3',
    'sp-day-4', 'sp-day-5', 'sp-day-6',
    'sp-work-start', 'sp-work-end', 'sp-break-start', 'sp-break-end',
  ];
  for (const id of settingEls) {
    document.getElementById(id)?.addEventListener('change', () => void saveSettingsFromUI());
  }

  document.getElementById('smart-indicator')?.addEventListener('click', openSmartModal);

  document.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'setting-language') {
      const newLang = (target as HTMLSelectElement).value as Lang;
      setLang(newLang);
      applyTranslations();
      setTimeout(() => {
        const labels = document.getElementsByClassName('gauge-label');
        const t2 = tr();
        if (labels[0]) labels[0].textContent = t2.sessionLabel;
        if (labels[1]) labels[1].textContent = t2.weeklyLabel;
      }, 0);
      if (lastWeeklyResetsAt) {
        window.claudeUsage.getDailyHistory().then(d => {
          dailyChart.render(d, lastWeeklyResetsAt!);
        });
      }
    }
  });
}

function setupModalClosers(): void {
  document.getElementById('day-detail-close')?.addEventListener('click', closeDayDetailModal);
  document.getElementById('day-detail-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('day-detail-modal')) closeDayDetailModal();
  });

  document.getElementById('update-major-later-btn')?.addEventListener('click', () => {
    document.getElementById('update-major-modal')?.classList.add('hidden');
    window.claudeUsage.dismissUpdate();
  });
  document.getElementById('update-major-download-btn')?.addEventListener('click', async () => {
    const progressWrap = document.getElementById('update-major-progress-wrap') as HTMLElement;
    const btn = document.getElementById('update-major-download-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Baixando...';
    progressWrap.style.display = 'block';
    try {
      await window.claudeUsage.downloadUpdate();
      document.getElementById('update-major-modal')?.classList.add('hidden');
    } catch {
      btn.disabled = false;
      btn.textContent = 'Tentar novamente';
    }
  });

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

function setupVisibilityHandler(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      document.querySelectorAll<HTMLElement>('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
    }
  });
}

function setupThemeHandler(): void {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    // Will be re-rendered on next updateUI
  });
}

async function loadSettings(): Promise<void> {
  try {
    const settings = await window.claudeUsage.getSettings();
    applyTheme(settings.theme);
    applySize(settings.windowSize);
    applySectionVisibility(settings);
    applyAutoRefresh(settings.autoRefresh, settings.autoRefreshInterval);
    setLang(settings.language as Lang);
    applyTranslations();

    (document.getElementById('setting-startup') as HTMLInputElement).checked = settings.launchAtStartup;
    (document.getElementById('setting-always-visible') as HTMLInputElement).checked = settings.alwaysVisible;
    (document.getElementById('setting-theme') as HTMLSelectElement).value = settings.theme;
    (document.getElementById('setting-language') as HTMLSelectElement).value = settings.language;
    (document.getElementById('setting-window-size') as HTMLSelectElement).value = settings.windowSize;
    (document.getElementById('setting-auto-refresh') as HTMLInputElement).checked = settings.autoRefresh;
    (document.getElementById('setting-auto-refresh-interval') as HTMLInputElement).value = String(settings.autoRefreshInterval);
    (document.getElementById('setting-compact-mode') as HTMLInputElement).checked = settings.compactMode;
    (document.getElementById('setting-show-account-bar') as HTMLInputElement).checked = settings.showAccountBar;
    (document.getElementById('setting-show-daily-chart') as HTMLInputElement).checked = settings.showDailyChart;
    (document.getElementById('setting-show-extra-bars') as HTMLInputElement).checked = settings.showExtraBars;
    (document.getElementById('setting-show-footer') as HTMLInputElement).checked = settings.showFooter;

    const notif = settings.notifications;
    (document.getElementById('setting-notif-enabled') as HTMLInputElement).checked = notif.enabled;
    (document.getElementById('setting-sound-enabled') as HTMLInputElement).checked = notif.soundEnabled;
    (document.getElementById('setting-notify-on-window-reset') as HTMLInputElement).checked = notif.notifyOnWindowReset;
    (document.getElementById('setting-notify-on-reset') as HTMLInputElement).checked = notif.notifyOnReset;
    (document.getElementById('setting-reset-threshold') as HTMLInputElement).value = String(notif.resetThreshold);
    (document.getElementById('setting-session-threshold') as HTMLInputElement).value = String(notif.sessionThreshold);
    (document.getElementById('setting-weekly-threshold') as HTMLInputElement).value = String(notif.weeklyThreshold);

    document.getElementById('lbl-reset-threshold')!.textContent = `${notif.resetThreshold}%`;
    document.getElementById('lbl-session-threshold')!.textContent = `${notif.sessionThreshold}%`;
    document.getElementById('lbl-weekly-threshold')!.textContent = `${notif.weeklyThreshold}%`;

    if (settings.autoBackupFolder) {
      const lbl = document.getElementById('lbl-auto-backup-folder');
      if (lbl) lbl.textContent = settings.autoBackupFolder;
    }

    if (settings.workSchedule) {
      const ws = settings.workSchedule;
      (document.getElementById('sp-enabled') as HTMLInputElement).checked = ws.enabled;
      ws.activeDays.forEach(d => {
        const el = document.getElementById(`sp-day-${d}`) as HTMLInputElement;
        if (el) el.checked = true;
      });
      (document.getElementById('sp-work-start') as HTMLInputElement).value = ws.workStart;
      (document.getElementById('sp-work-end') as HTMLInputElement).value = ws.workEnd;
      (document.getElementById('sp-break-start') as HTMLInputElement).value = ws.breakStart;
      (document.getElementById('sp-break-end') as HTMLInputElement).value = ws.breakEnd;
    }

    await loadCloudSyncStatus();

  } catch (err) {
    console.error('[App] loadSettings failed:', err);
  }
}

async function saveSettingsFromUI(): Promise<void> {
  try {
    const spActiveDays = [0, 1, 2, 3, 4, 5, 6].filter(d => (document.getElementById(`sp-day-${d}`) as HTMLInputElement)?.checked);

    const settings = {
      launchAtStartup: (document.getElementById('setting-startup') as HTMLInputElement).checked,
      alwaysVisible: (document.getElementById('setting-always-visible') as HTMLInputElement).checked,
      theme: (document.getElementById('setting-theme') as HTMLSelectElement).value as 'system' | 'dark' | 'light',
      language: (document.getElementById('setting-language') as HTMLSelectElement).value as 'en' | 'pt-BR',
      windowSize: (document.getElementById('setting-window-size') as HTMLSelectElement).value as 'normal' | 'medium' | 'large' | 'xlarge',
      autoRefresh: (document.getElementById('setting-auto-refresh') as HTMLInputElement).checked,
      autoRefreshInterval: parseInt((document.getElementById('setting-auto-refresh-interval') as HTMLInputElement).value, 10) || 300,
      compactMode: (document.getElementById('setting-compact-mode') as HTMLInputElement).checked,
      showAccountBar: (document.getElementById('setting-show-account-bar') as HTMLInputElement).checked,
      showDailyChart: (document.getElementById('setting-show-daily-chart') as HTMLInputElement).checked,
      showExtraBars: (document.getElementById('setting-show-extra-bars') as HTMLInputElement).checked,
      showFooter: (document.getElementById('setting-show-footer') as HTMLInputElement).checked,
      notifications: {
        enabled: (document.getElementById('setting-notif-enabled') as HTMLInputElement).checked,
        soundEnabled: (document.getElementById('setting-sound-enabled') as HTMLInputElement).checked,
        notifyOnWindowReset: (document.getElementById('setting-notify-on-window-reset') as HTMLInputElement).checked,
        notifyOnReset: (document.getElementById('setting-notify-on-reset') as HTMLInputElement).checked,
        resetThreshold: parseInt((document.getElementById('setting-reset-threshold') as HTMLInputElement).value, 10) || 50,
        sessionThreshold: parseInt((document.getElementById('setting-session-threshold') as HTMLInputElement).value, 10) || 80,
        weeklyThreshold: parseInt((document.getElementById('setting-weekly-threshold') as HTMLInputElement).value, 10) || 80,
      },
      workSchedule: {
        enabled: (document.getElementById('sp-enabled') as HTMLInputElement).checked,
        activeDays: spActiveDays,
        workStart: (document.getElementById('sp-work-start') as HTMLInputElement).value,
        workEnd: (document.getElementById('sp-work-end') as HTMLInputElement).value,
        breakStart: (document.getElementById('sp-break-start') as HTMLInputElement).value,
        breakEnd: (document.getElementById('sp-break-end') as HTMLInputElement).value,
      },
    };

    await window.claudeUsage.saveSettings(settings);
    applyTheme(settings.theme);
    applySize(settings.windowSize);
    applySectionVisibility(settings);
    applyAutoRefresh(settings.autoRefresh, settings.autoRefreshInterval);

  } catch (err) {
    console.error('[App] saveSettingsFromUI failed:', err);
  }
}

function applyAutoRefresh(enabled: boolean, intervalSeconds: number): void {
  autoRefreshEnabled = enabled;
  if (enabled) {
    const ms = Math.max(60, intervalSeconds) * 1000;
    void window.claudeUsage.setPollInterval(ms);
  } else {
    stopNextPollCountdown();
    void window.claudeUsage.setPollInterval(null);
  }
  const intervalRow = document.getElementById('row-auto-refresh-interval') as HTMLElement;
  intervalRow.style.opacity = enabled ? '1' : '0.4';
}

function startNextPollCountdown(intervalMs: number): void {
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

function stopNextPollCountdown(): void {
  if (nextPollTimer) { clearInterval(nextPollTimer); nextPollTimer = null; }
  const el = document.getElementById('next-poll-text') as HTMLElement;
  if (el) el.textContent = '';
}

function startRateLimitCountdown(until: number, resetAt?: number): void {
  const credModal = document.getElementById('credential-modal');
  if (!credModal?.classList.contains('hidden')) return;
  stopNextPollCountdown();
  if (countdownTimer) clearInterval(countdownTimer);

  const banner = document.getElementById('rate-limit-banner') as HTMLElement;
  const label = document.getElementById('rl-label') as HTMLElement;
  const timer = document.getElementById('rl-timer') as HTMLElement;
  document.getElementById('error-banner')!.classList.remove('visible');
  banner.classList.add('visible');

  const clockTime = resetAt ? new Date(resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

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
  document.getElementById('rate-limit-banner')?.classList.remove('visible');
}

async function loadCloudSyncStatus(): Promise<void> {
  try {
    const status = await window.claudeUsage.sync.getStatus();
    cloudSyncPanel.applyCloudSyncStatus(status);
  } catch (err) {
    console.error('[App] loadCloudSyncStatus failed:', err);
  }
}

function applyProfile(profile: { account: { display_name: string; email: string; has_claude_pro: boolean; has_claude_max: boolean } }): void {
  const avatarEl = document.getElementById('account-avatar');
  const nameEl = document.getElementById('account-name');
  const emailEl = document.getElementById('account-email');
  const planEl = document.getElementById('account-plan');
  const barEl = document.getElementById('account-bar');

  const name = profile.account.display_name || profile.account.email.split('@')[0];
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = profile.account.email;
  if (planEl) {
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
  }
  if (barEl) {
    barEl.dataset.hasProfile = 'true';
    barEl.style.display = '';
    fitWindow();
  }
}

function updateUI(data: { five_hour: { utilization: number; resets_at: string }; seven_day: { utilization: number; resets_at: string } }): void {
  const sessionPct = data.five_hour.utilization / 100;
  const weeklyPct = data.seven_day.utilization / 100;

  sessionGauge.update(sessionPct * 100);
  weeklyGauge.update(weeklyPct * 100);
  trayIcon.render(sessionPct * 100, weeklyPct * 100);

  const pctSessionEl = document.getElementById('pct-session');
  const pctWeeklyEl = document.getElementById('pct-weekly');
  const resetSessionEl = document.getElementById('reset-session');
  const resetAtSessionEl = document.getElementById('reset-at-session');
  const resetWeeklyEl = document.getElementById('reset-weekly');
  const resetAtWeeklyEl = document.getElementById('reset-at-weekly');

  if (pctSessionEl) pctSessionEl.textContent = `${Math.round(sessionPct * 100)}%`;
  if (pctWeeklyEl) pctWeeklyEl.textContent = `${Math.round(weeklyPct * 100)}%`;

  const resetAtSession = new Date(data.five_hour.resets_at);
  const resetAtWeekly = new Date(data.seven_day.resets_at);
  if (resetSessionEl) resetSessionEl.textContent = formatResetsIn(data.five_hour.resets_at, resetAtSession, tr());
  if (resetAtSessionEl) resetAtSessionEl.textContent = formatResetAt(resetAtSession, tr());
  if (resetWeeklyEl) resetWeeklyEl.textContent = formatResetsIn(data.seven_day.resets_at, resetAtWeekly, tr());
  if (resetAtWeeklyEl) resetAtWeeklyEl.textContent = formatResetAt(resetAtWeekly, tr());

  lastWeeklyResetsAt = data.seven_day.resets_at;
  lastWeeklyPct = weeklyPct;
  lastSessionPct = sessionPct;

  const updatedEl = document.getElementById('updated-text');
  lastUpdatedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (updatedEl) updatedEl.textContent = tr().updatedAt(lastUpdatedTime);

  fitWindow();
}

// Re-export for app.ts compatibility
export { openReportModal } from './ReportModal';