import { tr } from '../../layouts/i18n';

export function showConfirm(message: string, okText?: string, cancelText?: string): Promise<boolean> {
  return new Promise(resolve => {
    const modal = document.getElementById('generic-confirm-modal')!;
    const msgEl = document.getElementById('generic-confirm-msg')!;
    const okBtn = document.getElementById('generic-confirm-ok') as HTMLButtonElement;
    const cancelBtn = document.getElementById('generic-confirm-cancel') as HTMLButtonElement;

    if (!modal || !msgEl) { resolve(false); return; }

    msgEl.textContent = message;
    if (okBtn) okBtn.textContent = okText ?? tr().confirmOk;
    if (cancelBtn) { cancelBtn.textContent = cancelText ?? tr().confirmCancel; cancelBtn.style.display = ''; }

    modal.classList.remove('hidden');

    const cleanup = (result: boolean) => {
      modal.classList.add('hidden');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      modal.onclick = null;
      resolve(result);
    };

    okBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    modal.onclick = (e) => { if ((e.target as HTMLElement).closest('.modal-overlay') === modal) cleanup(false); };
  });
}

export function showInfo(message: string, okText?: string): Promise<void> {
  return new Promise(resolve => {
    const modal = document.getElementById('generic-confirm-modal')!;
    const msgEl = document.getElementById('generic-confirm-msg')!;
    const okBtn = document.getElementById('generic-confirm-ok') as HTMLButtonElement;
    const cancelBtn = document.getElementById('generic-confirm-cancel') as HTMLButtonElement;

    if (!modal || !msgEl) { resolve(); return; }

    msgEl.textContent = message;
    if (okBtn) { okBtn.textContent = okText ?? tr().confirmOk; okBtn.style.background = '#3b82f6'; }
    if (cancelBtn) cancelBtn.style.display = 'none';

    modal.classList.remove('hidden');

    const cleanup = () => {
      modal.classList.add('hidden');
      okBtn.onclick = null;
      modal.onclick = null;
      okBtn.style.background = '';
      if (cancelBtn) cancelBtn.style.display = '';
      resolve();
    };

    okBtn.onclick = cleanup;
    modal.onclick = (e) => { if ((e.target as HTMLElement).closest('.modal-overlay') === modal) cleanup(); };
  });
}

export function showForceRefreshModal(): void {
  const modal = document.getElementById('force-refresh-modal') as HTMLElement;
  if (!modal) return;
  modal.classList.remove('hidden');
}
