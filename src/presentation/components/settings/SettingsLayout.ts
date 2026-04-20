export interface Tab {
  bind(settings: any): void;
  read(): Partial<any>;
}

export function setupTabSwitcher(wrapperId: string, tabs: Tab[]): void {
  const buttons = document.queryAll<HTMLElement>(`#${wrapperId} .settings-tab-btn`);
  buttons.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.queryAll(`#${wrapperId} .settings-tab-content`).forEach((c, j) => {
        c.classList.toggle('hidden', j !== i);
      });
    });
  });
}
