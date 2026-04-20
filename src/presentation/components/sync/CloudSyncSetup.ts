import { tr } from '../../layouts/i18n';
import { CloudSyncPanel } from './CloudSyncPanel';

const cloudSyncPanel = new CloudSyncPanel();

export function getCloudSyncPanel(): CloudSyncPanel {
  return cloudSyncPanel;
}

export function setupCloudSync(): void {
  document.getElementById('btn-sync-enable')?.addEventListener('click', async () => {
    const urlEl = document.getElementById('sync-server-url') as HTMLInputElement;
    const labelEl = document.getElementById('sync-device-label') as HTMLInputElement;
    const errEl = document.getElementById('sync-setup-error') as HTMLElement;
    const btn = document.getElementById('btn-sync-enable') as HTMLButtonElement;
    errEl.style.display = 'none';
    errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Connecting...';
    try {
      await window.claudeUsage.sync.enable(urlEl.value.trim(), labelEl.value.trim() || undefined);
      const status = await window.claudeUsage.sync.getStatus();
      cloudSyncPanel.applyCloudSyncStatus(status);
    } catch (e) {
      errEl.textContent = e instanceof Error ? e.message : String(e);
      errEl.style.display = '';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in & enable';
    }
  });

  document.getElementById('btn-sync-now')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-now') as HTMLButtonElement;
    const errEl = document.getElementById('sync-enabled-error') as HTMLElement;
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = tr().syncSyncingBtn;
    try {
      await window.claudeUsage.sync.triggerNow();
      const status = await window.claudeUsage.sync.getStatus();
      cloudSyncPanel.applyCloudSyncStatus(status);
    } catch (e) {
      errEl.textContent = e instanceof Error ? e.message : String(e);
      errEl.style.display = '';
    } finally {
      btn.disabled = false;
      btn.textContent = tr().syncNowBtn;
    }
  });

  document.getElementById('btn-sync-disable')?.addEventListener('click', async () => {
    const errEl = document.getElementById('sync-enabled-error') as HTMLElement;
    errEl.style.display = 'none';
    try {
      await window.claudeUsage.sync.disable(false);
      const status = await window.claudeUsage.sync.getStatus();
      cloudSyncPanel.applyCloudSyncStatus(status);
    } catch (e) {
      errEl.textContent = e instanceof Error ? e.message : String(e);
      errEl.style.display = '';
    }
  });

  document.getElementById('btn-sync-wipe')?.addEventListener('click', async () => {
    if (!confirm('Delete all remote data?')) return;
    const errEl = document.getElementById('sync-enabled-error') as HTMLElement;
    errEl.style.display = 'none';
    try {
      await window.claudeUsage.sync.disable(true);
      const status = await window.claudeUsage.sync.getStatus();
      cloudSyncPanel.applyCloudSyncStatus(status);
    } catch (e) {
      errEl.textContent = e instanceof Error ? e.message : String(e);
      errEl.style.display = '';
    }
  });

  window.claudeUsage.sync.onEvent(async (data) => {
    if (['sync-started', 'sync-success', 'sync-error', 'sync-enabled', 'sync-disabled', 'enabled', 'disabled'].includes(data.type)) {
      const status = await window.claudeUsage.sync.getStatus();
      cloudSyncPanel.applyCloudSyncStatus(status);
    }
  });
}

export async function loadCloudSyncStatus(): Promise<void> {
  try {
    const status = await window.claudeUsage.sync.getStatus();
    cloudSyncPanel.applyCloudSyncStatus(status);
  } catch (err) {
    console.error('[App] loadCloudSyncStatus failed:', err);
  }
}
