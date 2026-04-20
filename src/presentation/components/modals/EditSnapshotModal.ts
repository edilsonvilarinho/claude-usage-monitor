import { dailyChart } from '../../../renderer/chartsInstance';

export function setupEditSnapshotHandlers(getLastWeeklyResetsAt: () => string | null): void {
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
    const lastWeeklyResetsAt = getLastWeeklyResetsAt();
    if (lastWeeklyResetsAt) dailyChart.render(updated, lastWeeklyResetsAt);
    (document.getElementById('edit-snapshot-modal') as HTMLElement).classList.add('hidden');
  });
}
