import { tr } from '../../layouts/i18n';
import { showConfirm, showInfo } from '../modals/GenericModals';
import { dailyChart } from '../../../renderer/chartsInstance';
import { openReportModal } from '../modals/ReportModal';
import { openDayDetailModal } from '../modals/DayDetailModal';

export function setupHistoryHandlers(getLastWeeklyResetsAt: () => string | null): void {
  document.getElementById('btn-clear-history')?.addEventListener('click', async () => {
    const t = tr();
    const ok = await showConfirm(t.clearHistoryConfirm, t.confirmClear, t.confirmCancel);
    if (!ok) return;
    await window.claudeUsage.clearDailyHistory();
    const resetsAt = getLastWeeklyResetsAt();
    if (resetsAt) dailyChart.render([], resetsAt);
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
    const resetsAt = getLastWeeklyResetsAt();
    if (resetsAt) {
      const updated = await window.claudeUsage.getDailyHistory();
      dailyChart.render(updated, resetsAt);
    } else {
      void window.claudeUsage.refreshNow();
    }
  });
}

export function setupReportHandlers(): void {
  document.getElementById('btn-report-history')?.addEventListener('click', () => void openReportModal());
  document.getElementById('btn-close-report')?.addEventListener('click', () => {
    document.getElementById('report-modal')?.classList.add('hidden');
  });
  dailyChart.setDayClickHandler((date) => void openDayDetailModal(date));
}
