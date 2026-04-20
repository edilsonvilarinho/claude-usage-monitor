import { fitWindow } from '../../layouts/PopupLayout';

export function setupUpdateBanner(): void {
  window.claudeUsage.onUpdateAvailable(({ version, url, downloadUrl, isMajor }) => {
    const banner = document.getElementById('update-banner') as HTMLElement;
    const label = document.getElementById('update-version-label') as HTMLElement;
    if (banner && label) {
      label.textContent = `v${version} disponível`;
      banner.style.display = 'flex';
      (banner as HTMLElement & { dataset: { url?: string; downloadUrl?: string } }).dataset.url = url;
      (banner as HTMLElement & { dataset: { url?: string; downloadUrl?: string } }).dataset.downloadUrl = downloadUrl;
      fitWindow();
    }
    if (isMajor) {
      const modal = document.getElementById('update-major-modal') as HTMLElement;
      const desc = document.getElementById('update-major-modal-desc') as HTMLElement;
      const btn = document.getElementById('update-major-download-btn') as HTMLButtonElement;
      if (modal && desc) {
        desc.textContent = `A versão v${version} inclui mudanças importantes.`;
        if (btn) btn.textContent = `Baixar v${version}`;
        modal.classList.remove('hidden');
      }
    }
  });

  document.getElementById('btn-update-download')?.addEventListener('click', () => {
    const banner = document.getElementById('update-banner') as HTMLElement & { dataset?: { downloadUrl?: string; url?: string } };
    const downloadUrl = banner?.dataset?.downloadUrl;
    const releaseUrl = banner?.dataset?.url;
    if (downloadUrl) void window.claudeUsage.downloadUpdate();
    else if (releaseUrl) window.claudeUsage.openReleaseUrl(releaseUrl);
  });

  window.claudeUsage.onUpdateDownloadProgress((pct) => {
    const fill = document.getElementById('update-major-progress-fill') as HTMLElement;
    const labelEl = document.getElementById('update-major-progress-label') as HTMLElement;
    if (fill) fill.style.width = `${pct}%`;
    if (labelEl) labelEl.textContent = `${Math.round(pct)}%`;
  });
}
