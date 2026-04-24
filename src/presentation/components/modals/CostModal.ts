import { costGauge } from '../../../renderer/chartsInstance';

export function initCostGauge(): void {
  costGauge.mount();
}

export function setupCostModalHandlers(): void {
  document.getElementById('btn-cost')?.addEventListener('click', () => {
    document.getElementById('cost-modal')?.classList.remove('hidden');
    try { initCostGauge(); } catch (_) { /* canvas not ready */ }
    loadCostData();
  });
  document.getElementById('cost-modal-close')?.addEventListener('click', () => {
    document.getElementById('cost-modal')?.classList.add('hidden');
  });
  document.getElementById('cost-modal')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.modal-overlay') === document.getElementById('cost-modal')) {
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

export function loadCostData(): void {
  window.claudeUsage.getCostEstimate().then(cost => {
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

    try { costGauge.update(cost.budgetPercentage); } catch (_) { /* chart not ready */ }

    const modelLabel = cost.session.model.charAt(0).toUpperCase() + cost.session.model.slice(1);
    const ratesLabel = `$${cost.modelRates.input}/M in · $${cost.modelRates.output}/M out`;
    const fmtTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

    document.getElementById('cost-formula-session-pct')!.textContent = `${cost.sessionPct.toFixed(1)}%`;
    document.getElementById('cost-formula-session-model')!.textContent = modelLabel;
    document.getElementById('cost-formula-session-rates')!.textContent = ratesLabel;
    document.getElementById('cost-formula-session-tokens')!.textContent = `${fmtTokens(cost.session.inputTokens)} in + ${fmtTokens(cost.session.outputTokens)} out`;

    document.getElementById('cost-formula-weekly-pct')!.textContent = `${cost.weeklyPct.toFixed(1)}%`;
    document.getElementById('cost-formula-weekly-model')!.textContent = modelLabel;
    document.getElementById('cost-formula-weekly-rates')!.textContent = ratesLabel;
    document.getElementById('cost-formula-weekly-tokens')!.textContent = `${fmtTokens(cost.weekly.inputTokens)} in + ${fmtTokens(cost.weekly.outputTokens)} out`;

    document.getElementById('cost-formula-monthly-tokens')!.textContent = `${fmtTokens(cost.monthly.inputTokens)} in + ${fmtTokens(cost.monthly.outputTokens)} out`;

    document.querySelectorAll<HTMLElement>('.cost-model-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.model === cost.session.model);
    });
  });
}
