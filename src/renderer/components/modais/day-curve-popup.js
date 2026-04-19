export const DAY_CURVE_POPUP_HTML = `
<div id="day-curve-overlay" class="modal-overlay hidden">
  <div id="day-curve-popup" class="day-curve-popup">
    <div class="day-curve-header">
      <span id="day-curve-title" class="day-curve-title"></span>
      <button id="day-curve-close" class="icon-btn" style="font-size:10px;padding:2px 5px;">✕</button>
    </div>
    <div class="day-curve-chart-wrap">
      <canvas id="day-curve-canvas"></canvas>
    </div>
    <div id="day-curve-empty" class="day-curve-empty hidden">Sem dados</div>
  </div>
</div>
`;