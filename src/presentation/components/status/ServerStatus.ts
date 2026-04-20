import { tr } from '../../layouts/i18n';

export function setupServerStatus(): void {
  const serverStatusDot = document.getElementById('server-status-dot') as HTMLElement;
  const serverStatusBtn = document.getElementById('btn-server-status') as HTMLElement;
  const onlineUsersBtn = document.getElementById('btn-online-users') as HTMLElement;
  const onlineUsersCount = document.getElementById('online-users-count') as HTMLElement;

  if (serverStatusBtn) serverStatusBtn.style.display = '';
  if (onlineUsersBtn) onlineUsersBtn.style.display = '';

  const updateUI = (status: string): void => {
    if (!serverStatusDot || !serverStatusBtn) return;
    const cssStatus = status === 'connected' ? 'online' : status === 'disconnected' ? 'disconnected' : status;
    serverStatusDot.className = 'server-status-dot server-status-' + cssStatus;
    const t = tr();
    const labels: Record<string, string> = {
      connected: t.serverStatusOnline,
      disconnected: t.serverStatusOffline,
      connecting: t.serverStatusConnecting,
      error: t.serverStatusError,
    };
    serverStatusBtn.title = labels[status] ?? status;
  };

  window.claudeUsage.server.onStatusChange((event) => updateUI(event.status));
  void window.claudeUsage.server.getStatus().then((status) => updateUI(status));

  window.claudeUsage.server.onClientCountChange((count) => {
    if (onlineUsersCount) onlineUsersCount.textContent = count > 0 ? String(count) : '—';
  });
  void window.claudeUsage.server.getClientCount().then((count) => {
    if (onlineUsersCount) onlineUsersCount.textContent = count > 0 ? String(count) : '—';
  });
}
