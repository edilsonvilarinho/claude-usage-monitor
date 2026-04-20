export function setupUpdateMajorModal(): void {
  document.getElementById('update-major-later-btn')?.addEventListener('click', () => {
    document.getElementById('update-major-modal')?.classList.add('hidden');
    window.claudeUsage.dismissUpdate();
  });

  document.getElementById('update-major-download-btn')?.addEventListener('click', async () => {
    const progressWrap = document.getElementById('update-major-progress-wrap') as HTMLElement;
    const btn = document.getElementById('update-major-download-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Baixando...';
    progressWrap.style.display = 'block';
    try {
      await window.claudeUsage.downloadUpdate();
      document.getElementById('update-major-modal')?.classList.add('hidden');
    } catch {
      btn.disabled = false;
      btn.textContent = 'Tentar novamente';
    }
  });
}
