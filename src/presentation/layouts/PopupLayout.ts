import { tr } from '../layouts/i18n';

export function fitWindow(): void {
  requestAnimationFrame(() => {
    const header = document.querySelector('.header') as HTMLElement;
    const accountBar = document.getElementById('account-bar') as HTMLElement;
    const smartRecBar = document.getElementById('smart-rec-bar') as HTMLElement;
    const content = document.querySelector('.content') as HTMLElement;
    const footer = document.querySelector('.footer') as HTMLElement;
    const accountBarH = (accountBar?.style.display !== 'none' ? accountBar?.offsetHeight : 0) ?? 0;
    const h = header.offsetHeight + accountBarH + (smartRecBar?.offsetHeight ?? 0) + content.scrollHeight + (footer?.offsetHeight ?? 0);
    window.claudeUsage.setWindowHeight(h);
  });
}

export function applySize(size: string): void {
  document.body.dataset.size = size;
  requestAnimationFrame(() => {
    fitWindow();
  });
}

export function applyTheme(theme: string): void {
  document.body.dataset.theme = theme;
}

export function applySectionVisibility(opts: { showDailyChart: boolean; showExtraBars: boolean; showFooter: boolean; showAccountBar: boolean }): void {
  const dailyChart = document.getElementById('daily-chart-section');
  const extraSection = document.getElementById('extra-section');
  const footer = document.querySelector('.footer') as HTMLElement;
  const accountBar = document.getElementById('account-bar');

  if (dailyChart) dailyChart.style.display = opts.showDailyChart ? '' : 'none';
  if (extraSection && !opts.showExtraBars) extraSection.style.display = 'none';
  if (footer) footer.style.display = opts.showFooter ? '' : 'none';
  if (accountBar) accountBar.style.display = opts.showAccountBar ? '' : 'none';

  fitWindow();
}