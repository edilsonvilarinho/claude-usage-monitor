import { tr, setLang, applyTranslations } from '../presentation/layouts/i18n';
import type { Lang } from '../presentation/layouts/i18n';
import { fitWindow, applySize, applySectionVisibility, applyTheme } from '../presentation/layouts/PopupLayout';
import { setupTabSwitcher } from '../presentation/components/settings/SettingsLayout';
import { setupCostModalHandlers } from '../presentation/components/modals/CostModal';
import { applySmartIndicator, setCurrentSmartStatus, openSmartModal } from '../presentation/components/modals/SmartPlanModal';
import { dailyChart, burnRate, sessionGauge, weeklyGauge } from './chartsInstance';
import { closeDayDetailModal } from '../presentation/components/modals/DayDetailModal';
import { setupErrorBanner } from '../presentation/components/banners/ErrorBanner';
import { startRateLimitCountdown, clearRateLimitBanner } from '../presentation/components/banners/RateLimitBanner';
import { setupUpdateBanner } from '../presentation/components/banners/UpdateBanner';
import { setupCredentialForm } from '../presentation/components/modals/CredentialModal';
import { setupUpdateMajorModal } from '../presentation/components/modals/UpdateMajorModal';
import { setupEditSnapshotHandlers } from '../presentation/components/modals/EditSnapshotModal';
import { setupSettingsModal, loadSettingsToModal, readSettingsFromModal } from '../presentation/components/settings/SettingsModal';
import { updateDashboard } from '../presentation/pages/Dashboard';
import { setupCloudSync, loadCloudSyncStatus } from '../presentation/components/sync/CloudSyncSetup';
import { setupServerStatus } from '../presentation/components/status/ServerStatus';
import { applyProfile } from '../presentation/components/status/AccountBar';
import { applyAutoRefresh, startNextPollCountdown, stopNextPollCountdown, isAutoRefreshEnabled } from '../presentation/shared/autoRefresh';
import { setupHistoryHandlers, setupReportHandlers } from '../presentation/components/history/HistoryPanel';
import { setupHeaderHandlers } from '../presentation/components/header/HeaderHandlers';

let lastWeeklyResetsAt: string | null = null;
let currentSmartStatus: import('../globals').SmartStatus | null = null;

export async function bootstrap(): Promise<void> {
  sessionGauge.mount();
  weeklyGauge.mount();

  setupCloudSync();
  setupUpdateBanner();
  setupErrorBanner();
  setupHeaderHandlers();
  setupServerStatus();
  setupCostModalHandlers();

  document.getElementById('day-detail-close')?.addEventListener('click', closeDayDetailModal);
  document.getElementById('day-detail-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('day-detail-modal')) closeDayDetailModal();
  });
  document.getElementById('smart-indicator')?.addEventListener('click', openSmartModal);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      document.querySelectorAll<HTMLElement>('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
    }
  });

  window.claudeUsage.onProfileUpdated(applyProfile);

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
    updateDashboard(data, v => { lastWeeklyResetsAt = v; });
    void burnRate.updateSession();
    void burnRate.updateWeekly();
    if (lastWeeklyResetsAt) {
      const liveSession = data.five_hour.utilization;
      const liveWeekly  = data.seven_day.utilization;
      window.claudeUsage.getDailyHistory().then(d =>
        dailyChart.render(d, lastWeeklyResetsAt!, liveWeekly, liveSession)
      );
    }
  });

  window.claudeUsage.onRateLimited((until, resetAt) => {
    stopNextPollCountdown();
    startRateLimitCountdown(until, resetAt);
  });

  window.claudeUsage.onNextPollAt((next) => {
    if (isAutoRefreshEnabled()) {
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
      el.textContent = tr().lastRespErr(info.code ? String(info.code) : (info.message ?? 'Error'), time);
      el.className = 'last-resp-text err';
    }
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
  setupHistoryHandlers(() => lastWeeklyResetsAt);
  setupReportHandlers();
  setupEditSnapshotHandlers(() => lastWeeklyResetsAt);
  setupUpdateMajorModal();
  setupSettingsModal(() => void saveSettingsFromUI(), loadCloudSyncStatus);
  setupTabSwitcher();

  await loadSettings();
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
    loadSettingsToModal(settings);
    await loadCloudSyncStatus();
  } catch (err) {
    console.error('[App] loadSettings failed:', err);
  }
}

async function saveSettingsFromUI(): Promise<void> {
  try {
    const settings = readSettingsFromModal();
    await window.claudeUsage.saveSettings(settings);
    applyTheme(settings.theme!);
    applySize(settings.windowSize!);
    applySectionVisibility(settings as { showDailyChart: boolean; showExtraBars: boolean; showFooter: boolean; showAccountBar: boolean });
    applyAutoRefresh(settings.autoRefresh!, settings.autoRefreshInterval!);
    if (settings.language) {
      setLang(settings.language as Lang);
      applyTranslations();
      setTimeout(() => {
        const labels = document.getElementsByClassName('gauge-label');
        const t2 = tr();
        if (labels[0]) labels[0].textContent = t2.sessionLabel;
        if (labels[1]) labels[1].textContent = t2.weeklyLabel;
      }, 0);
      if (lastWeeklyResetsAt) {
        window.claudeUsage.getDailyHistory().then(d => dailyChart.render(d, lastWeeklyResetsAt!));
      }
    }
  } catch (err) {
    console.error('[App] saveSettingsFromUI failed:', err);
  }
}

// Re-export for app.ts compatibility
export { openReportModal } from '../presentation/components/modals/ReportModal';
