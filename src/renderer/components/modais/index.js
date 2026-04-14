export { FORCE_REFRESH_MODAL_HTML } from './force-refresh-modal.js';
export { CREDENTIAL_MODAL_HTML } from './credential-modal.js';
export { DAY_DETAIL_MODAL_HTML } from './day-detail-modal.js';
export { REPORT_MODAL_HTML } from './report-modal.js';
export { EDIT_SNAPSHOT_MODAL_HTML } from './edit-snapshot-modal.js';
export { DAY_CURVE_POPUP_HTML } from './day-curve-popup.js';
export { COST_MODAL_HTML } from './cost-modal.js';
export { SMART_SCHEDULER_MODAL_HTML } from './smart-scheduler-modal.js';
export { SETTINGS_MODAL_HTML } from './settings-modal.js';

export function injectAllModals() {
  const container = document.body;
  
  container.insertAdjacentHTML('beforeend', FORCE_REFRESH_MODAL_HTML);
  container.insertAdjacentHTML('beforeend', CREDENTIAL_MODAL_HTML);
  container.insertAdjacentHTML('beforeend', DAY_DETAIL_MODAL_HTML);
  container.insertAdjacentHTML('beforeend', REPORT_MODAL_HTML);
  container.insertAdjacentHTML('beforeend', EDIT_SNAPSHOT_MODAL_HTML);
  container.insertAdjacentHTML('beforeend', DAY_CURVE_POPUP_HTML);
  container.insertAdjacentHTML('beforeend', COST_MODAL_HTML);
  container.insertAdjacentHTML('beforeend', SMART_SCHEDULER_MODAL_HTML);
  container.insertAdjacentHTML('beforeend', SETTINGS_MODAL_HTML);
}