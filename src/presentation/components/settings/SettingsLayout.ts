export function setupTabSwitcher(): void {
  const buttons = document.querySelectorAll<HTMLElement>('.settings-tabs .tab-btn');
  const panes = document.querySelectorAll<HTMLElement>('.tab-pane');
  panes.forEach((pane, i) => pane.classList.toggle('hidden', i !== 0));
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      if (!tabId) return;
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      panes.forEach(pane => pane.classList.toggle('hidden', pane.id !== tabId));
    });
  });
}
