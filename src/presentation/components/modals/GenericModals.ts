import { tr } from '../../layouts/i18n';

let resolvePromise: ((result: boolean) => void) | null = null;

export function showConfirm(message: string, okText?: string, cancelText?: string): Promise<boolean> {
  const modal = document.getElementById('confirm-modal') as HTMLElement;
  const msgEl = document.getElementById('confirm-message') as HTMLElement;
  const okBtn = document.getElementById('confirm-ok-btn') as HTMLElement;
  const cancelBtn = document.getElementById('confirm-cancel-btn') as HTMLElement;

  if (!modal || !msgEl) return Promise.resolve(false);

  msgEl.textContent = message;
  if (okBtn) okBtn.textContent = okText ?? tr().confirmOk;
  if (cancelBtn) cancelBtn.textContent = cancelText ?? tr().confirmCancel;

  modal.classList.remove('hidden');

  return new Promise(resolve => {
    resolvePromise = resolve;

    const cleanup = () => {
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    const handleOk = () => { cleanup(); resolvePromise!(true); resolvePromise = null; };
    const handleCancel = () => { cleanup(); resolvePromise!(false); resolvePromise = null; };

    okBtn.addEventListener('click', handleOk, { once: true });
    cancelBtn.addEventListener('click', handleCancel, { once: true });
  });
}

export function showInfo(message: string, okText?: string): Promise<void> {
  const modal = document.getElementById('info-modal') as HTMLElement;
  const msgEl = document.getElementById('info-message') as HTMLElement;
  const okBtn = document.getElementById('info-ok-btn') as HTMLElement;

  if (!modal || !msgEl) return Promise.resolve();

  msgEl.textContent = message;
  if (okBtn) okBtn.textContent = okText ?? tr().confirmOk;

  modal.classList.remove('hidden');

  return new Promise(resolve => {
    const cleanup = () => {
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', handleOk);
    };

    const handleOk = () => { cleanup(); resolve(); };

    okBtn.addEventListener('click', handleOk, { once: true });
  });
}
