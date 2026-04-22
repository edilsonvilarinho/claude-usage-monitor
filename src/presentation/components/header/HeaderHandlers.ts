import { tr } from '../../layouts/i18n';
import { showForceRefreshModal } from '../modals/GenericModals';
import { isRateLimited, clearRateLimitBanner } from '../banners/RateLimitBanner';
import { openCliSessionsModal } from '../modals/CliSessionsModal';

export function setupHeaderHandlers(): void {
  document.getElementById('btn-close')?.addEventListener('click', () => {
    document.querySelectorAll<HTMLElement>('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
    window.claudeUsage.closeWindow();
  });

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    if (isRateLimited()) {
      showForceRefreshModal();
      return;
    }
    void window.claudeUsage.refreshNow();
    (document.getElementById('updated-text') as HTMLElement).textContent = tr().refreshingText;
  });

  document.getElementById('modal-cancel')?.addEventListener('click', () => {
    document.getElementById('force-refresh-modal')?.classList.add('hidden');
  });

  document.getElementById('modal-confirm')?.addEventListener('click', () => {
    const btn = document.getElementById('modal-confirm') as HTMLButtonElement;
    const originalText = btn.textContent ?? '';
    btn.disabled = true;
    btn.textContent = tr().forcingText;
    document.getElementById('force-refresh-modal')?.classList.add('hidden');
    clearRateLimitBanner();
    (document.getElementById('updated-text') as HTMLElement).textContent = tr().refreshingText;
    void window.claudeUsage.forceRefreshNow().finally(() => {
      btn.disabled = false;
      btn.textContent = originalText;
    });
  });

  document.getElementById('btn-update-header')?.addEventListener('click', () => void window.claudeUsage.checkForUpdate());
  document.getElementById('btn-cli-sessions')?.addEventListener('click', () => void openCliSessionsModal());
}
