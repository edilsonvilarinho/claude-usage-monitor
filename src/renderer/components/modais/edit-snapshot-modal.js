export const EDIT_SNAPSHOT_MODAL_HTML = `
<div id="edit-snapshot-modal" class="modal-overlay hidden">
  <div class="modal-box edit-snapshot-box">
    <p class="modal-msg" data-i18n="editSnapshotTitle">Editar dados do dia</p>
    <div class="edit-snapshot-form">
      <div class="edit-row">
        <label class="edit-label" data-i18n="editDateLabel">Dia</label>
        <select class="setting-select" id="edit-date-select"></select>
      </div>
      <div class="edit-row">
        <label class="edit-label" data-i18n="editSessionLabel">Sessão pico (%)</label>
        <input type="number" class="spinner-input edit-input" id="edit-maxSession" min="0" max="999" />
      </div>
      <div class="edit-row">
        <label class="edit-label" data-i18n="editAccumLabel">Acumulado (%)</label>
        <input type="number" class="spinner-input edit-input" id="edit-sessionAccum" min="0" max="9999" />
      </div>
      <div class="edit-row">
        <label class="edit-label" data-i18n="editResetsLabel">Nº resets</label>
        <input type="number" class="spinner-input edit-input" id="edit-sessionWindowCount" min="1" max="99" />
      </div>
      <div class="edit-row">
        <label class="edit-label" data-i18n="editWeeklyLabel">Semanal máx. (%)</label>
        <input type="number" class="spinner-input edit-input" id="edit-maxWeekly" min="0" max="999" />
      </div>
    </div>
    <div class="modal-actions">
      <button id="edit-snapshot-cancel" data-i18n="editCancelBtn">Cancelar</button>
      <button id="edit-snapshot-save" data-i18n="editSaveBtn">Salvar</button>
    </div>
  </div>
</div>
`;