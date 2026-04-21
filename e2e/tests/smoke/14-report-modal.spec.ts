/**
 * TC-14.x — ReportModal: taxa de saturação, heatmap e tendência semanal
 */
import { test, expect, type Page } from '@playwright/test';
import { launchApp, closeApp, type TestApp } from '../../helpers/electron-launch';
import { DAILY_HISTORY_3DAYS } from '../../fixtures/daily-history';
import { NORMAL_USAGE } from '../../fixtures/usage-data';

const SESSION_WINDOWS_WITH_PEAKS = [
  { resetsAt: '2026-04-21T12:00:00Z', peak: 110, final: 110, date: '2026-04-21', peakTs: new Date('2026-04-21T09:30:00').getTime() },
  { resetsAt: '2026-04-20T12:00:00Z', peak: 85,  final: 85,  date: '2026-04-20', peakTs: new Date('2026-04-20T14:00:00').getTime() },
  { resetsAt: '2026-04-19T12:00:00Z', peak: 120, final: 120, date: '2026-04-19', peakTs: new Date('2026-04-19T20:00:00').getTime() },
];

const SESSION_WINDOWS_NO_PEAKS = [
  { resetsAt: '2026-04-21T12:00:00Z', peak: 50, final: 50, date: '2026-04-21' },
];

async function openReportModal(page: Page): Promise<void> {
  await page.evaluate((data) => {
    (window as any).__emit('usage', data);
  }, NORMAL_USAGE);
  await page.locator('#btn-report-history').click();
  await expect(page.locator('#report-modal')).not.toHaveClass(/hidden/);
}

test.describe('TC-14 — ReportModal: novas métricas', () => {
  let testApp: TestApp;
  let page: Page;

  test.beforeAll(async () => {
    testApp = await launchApp({
      _mockData: {
        dailyHistory: DAILY_HISTORY_3DAYS,
        sessionWindows: SESSION_WINDOWS_WITH_PEAKS,
        currentWindow: null,
      },
    });
    page = testApp.page;
  });

  test.afterAll(async () => {
    await closeApp(testApp.app);
  });

  test.beforeEach(async () => {
    await page.evaluate(() => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    });
  });

  // ── Saturação ────────────────────────────────────────────────────────────────

  test('TC-14.1: modal abre e exibe #report-saturation', async () => {
    await openReportModal(page);
    await expect(page.locator('#report-saturation')).toBeVisible();
  });

  test('TC-14.2: taxa de saturação exibe 67% com 2/3 janelas saturadas', async () => {
    await openReportModal(page);
    const satEl = page.locator('#report-saturation');
    await expect(satEl).toContainText('67%');
  });

  // ── Heatmap ─────────────────────────────────────────────────────────────────

  test('TC-14.3: heatmap visível com células .heatmap-cell', async () => {
    await openReportModal(page);
    await expect(page.locator('#report-heatmap')).toBeVisible();
    const cells = page.locator('#report-heatmap .heatmap-cell');
    await expect(cells).toHaveCount(21); // 7 dias × 3 períodos
  });

  // ── Tendência ────────────────────────────────────────────────────────────────

  test('TC-14.4: tendência exibe #report-trend', async () => {
    await openReportModal(page);
    await expect(page.locator('#report-trend')).toBeVisible();
  });

  test('TC-14.5: tendência é "flat" quando histórico < 7 dias', async () => {
    await openReportModal(page);
    const trendVal = page.locator('#report-trend .report-trend-value');
    await expect(trendVal).toHaveClass(/flat/);
  });
});
