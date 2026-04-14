export const REPORT_MODAL_HTML = `
<div id="report-modal" class="modal-overlay hidden">
  <div class="modal-box report-modal-box">
    <div class="day-detail-header">
      <span class="day-detail-title-text" data-i18n="reportTitle">Relatório de Uso</span>
      <button id="btn-close-report" class="day-detail-close-btn">✕</button>
    </div>
    <div class="report-chart-wrap">
      <canvas id="report-chart"></canvas>
    </div>
    <div id="report-stats" class="report-stats"></div>
    <div id="report-windows" class="report-windows"></div>
    <div id="report-analytics" class="report-analytics"></div>
  </div>
</div>
`;