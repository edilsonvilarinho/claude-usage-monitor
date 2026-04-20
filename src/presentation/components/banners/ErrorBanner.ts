import { tr } from '../../layouts/i18n';

export function setupErrorBanner(): void {
  window.claudeUsage.onError((msg) => {
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) return;
    const banner = document.getElementById('error-banner') as HTMLElement;
    banner.textContent = `${tr().errorPrefix}${msg}`;
    banner.classList.add('visible');
    const dot = document.getElementById('status-dot') as HTMLElement;
    dot.classList.add('error');
    (document.getElementById('updated-text') as HTMLElement).textContent =
      tr().failedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  });
}
