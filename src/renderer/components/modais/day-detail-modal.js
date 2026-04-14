export const DAY_DETAIL_MODAL_HTML = `
<div id="day-detail-modal" class="modal-overlay hidden">
  <div class="modal-box day-detail-box">
    <div class="day-detail-header">
      <span id="day-detail-title" class="day-detail-title-text"></span>
      <button id="day-detail-close" class="day-detail-close-btn">✕</button>
    </div>
    <div id="day-detail-chart-wrap" class="day-detail-chart-wrap">
      <canvas id="day-detail-canvas"></canvas>
    </div>
    <div id="day-detail-empty" class="day-detail-empty hidden"></div>
  </div>
</div>
`;