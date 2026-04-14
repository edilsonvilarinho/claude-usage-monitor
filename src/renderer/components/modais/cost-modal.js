export const COST_MODAL_HTML = `
<div id="cost-modal" class="modal-overlay hidden">
  <div class="modal-box cost-modal-box">
    <div class="cost-modal-header">
      <span class="cost-modal-title" data-i18n="costModalTitle">Custo Estimado</span>
      <button id="cost-modal-close" class="icon-btn" style="font-size:12px;padding:4px 8px;">✕</button>
    </div>
    <div class="cost-tabs">
      <button class="cost-tab active" data-cost-tab="session" data-i18n="costTabSession">Sessão</button>
      <button class="cost-tab" data-cost-tab="weekly" data-i18n="costTabWeekly">Semanal</button>
      <button class="cost-tab" data-cost-tab="monthly" data-i18n="costTabMonthly">Mensal</button>
    </div>
    <div class="cost-content">
      <div id="cost-session" class="cost-pane active">
        <div class="cost-value" id="cost-session-value">$0.00</div>
        <div class="cost-period" data-i18n="costPeriodSession">Sessão atual (5h)</div>
        <div class="cost-breakdown">
          <div class="cost-breakdown-row">
            <span>Input</span>
            <span id="cost-session-input">$0.00</span>
          </div>
          <div class="cost-breakdown-row">
            <span>Output</span>
            <span id="cost-session-output">$0.00</span>
          </div>
        </div>
      </div>
      <div id="cost-weekly" class="cost-pane">
        <div class="cost-value" id="cost-weekly-value">$0.00</div>
        <div class="cost-period" data-i18n="costPeriodWeekly">Últimos 7 dias</div>
        <div class="cost-breakdown">
          <div class="cost-breakdown-row">
            <span>Input</span>
            <span id="cost-weekly-input">$0.00</span>
          </div>
          <div class="cost-breakdown-row">
            <span>Output</span>
            <span id="cost-weekly-output">$0.00</span>
          </div>
        </div>
      </div>
      <div id="cost-monthly" class="cost-pane">
        <div class="cost-gauge-wrap">
          <canvas id="cost-gauge"></canvas>
          <div class="cost-gauge-label"><span id="cost-monthly-pct">0</span>%</div>
        </div>
        <div class="cost-value" id="cost-monthly-value">$0.00</div>
        <div class="cost-budget">
          <span data-i18n="costBudgetOf">de</span>
          <span class="cost-budget-value" id="cost-budget-value">$50.00</span>
        </div>
        <div class="cost-breakdown">
          <div class="cost-breakdown-row">
            <span>Input</span>
            <span id="cost-monthly-input">$0.00</span>
          </div>
          <div class="cost-breakdown-row">
            <span>Output</span>
            <span id="cost-monthly-output">$0.00</span>
          </div>
        </div>
      </div>
    </div>
    <div class="cost-warning" data-i18n="costWarning">
      ⚠️ Valor estimado baseado na API padrão. Planos Team/Enterprise podem ter taxas diferentes.
    </div>
    <div class="cost-settings">
      <label data-i18n="costBudgetLabel">Orçamento mensal:</label>
      <div class="cost-budget-input-wrap">
        <span>$</span>
        <input type="number" id="cost-budget-input" min="1" max="1000" value="50" />
      </div>
    </div>
  </div>
</div>
`;