import { syncStore } from '../../../renderer/stores/syncStore';
import { tr } from '../../layouts/i18n';
import type { Lang } from '../../layouts/i18n';
import type { SyncStatus } from '../../../services/syncService';

export class CloudSyncPanel {
  applyCloudSyncStatus(status: SyncStatus): void {
    this.updateHeaderIcon({ enabled: status.enabled });
    if (status.enabled) {
      this.renderEnabled({ email: status.email, lastSyncAt: status.lastSyncAt, pendingOps: status.pendingOps });
    } else {
      this.renderDisabled();
    }
  }

  renderEnabled(status: { email: string; lastSyncAt: number; pendingOps: number }): void {
    const setup = document.getElementById('cloud-sync-setup') as HTMLElement;
    const panel = document.getElementById('cloud-sync-status') as HTMLElement;
    if (!setup || !panel) return;

    setup.style.display = 'none';
    panel.style.display = '';

    const emailEl = document.getElementById('sync-email');
    if (emailEl) emailEl.textContent = status.email || '—';

    const lastEl = document.getElementById('sync-last');
    if (lastEl) lastEl.textContent = tr().syncNever;

    const pendingEl = document.getElementById('sync-pending');
    if (pendingEl) pendingEl.textContent = String(status.pendingOps);
  }

  renderDisabled(): void {
    const setup = document.getElementById('cloud-sync-setup') as HTMLElement;
    const panel = document.getElementById('cloud-sync-status') as HTMLElement;
    if (!setup || !panel) return;

    setup.style.display = '';
    panel.style.display = 'none';
  }

  updateHeaderIcon(status: { enabled: boolean }): void {
    syncStore.set('syncLastKnownStatus', status.enabled ? 'synced' : null);
  }
}
