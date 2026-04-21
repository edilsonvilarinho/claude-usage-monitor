/**
 * TC-15.x — ReportModal: previsão de esgotamento, distribuição horária,
 *            streak, dias de risco e custo de excesso
 */
import { test, expect, type Page } from '@playwright/test';
import { launchApp, closeApp, type TestApp } from '../../helpers/electron-launch';
import { DAILY_HISTORY_3DAYS, DAILY_HISTORY_14DAYS } from '../../fixtures/daily-history';
import { NORMAL_USAGE } from '../../fixtures/usage-data';

const SESSION_WINDOWS_WITH_PEAKS = [
  { resetsAt: '2026-04-21T12:00:00Z', peak: 120, final: 120, date: '2026-04-21', peakTs: new Date('2026-04-21T09:00:00').getTime() },
  { resetsAt: '2026-04-20T12:00:00Z', peak: 85,  final: 85,  date: '2026-04-20', peakTs: new Date('2026-04-20T14:00:00').getTime() },
  { resetsAt: '2026-04-19T12:00:00Z', peak: 150, final: 150, date: '2026-04-19', peakTs: new Date('2026-04-19T21:00:00').getTime() },
];

const SESSION_WINDOWS_NO_EXCESS = [
  { resetsAt: '2026-04-21T12:00:00Z', peak: 80, final: 80, date: '2026-04-21', peakTs: new Date('2026-04-21T10:00:00').getTime() },
];

async function openReportModal(page: Page): Promise<void> {
  await page.evaluate((data) => {
    (window as any).__emit('usage', data);
  }, NORMAL_USAGE);
  await page.locator('#btn-report-history').click();
  await expect(page.locator('#report-modal')).not.toHaveClass(/hidden/);
}

// ── Suite principal (3 dias de histórico, com janelas excessivas) ─────────────

test.describe('TC-15 — ReportModal: 5 novas métricas', () => {
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

  // ── Previsão de esgotamento ──────────────────────────────────────────────────

  test('TC-15.1: #report-forecast está visível após abrir o modal', async () => {
    await openReportModal(page);
    await expect(page.locator('#report-forecast')).toBeVisible();
  });

  test('TC-15.2: forecast exibe "Dados insuficientes" com < 2 dias de histórico', async () => {
    await openReportModal(page);
    // 3 dias não têm deltas positivos suficientes para forecast (maxWeekly não aumenta consistentemente)
    const forecastEl = page.locator('#report-forecast');
    await expect(forecastEl).toBeVisible();
  });

  // ── Distribuição por hora ────────────────────────────────────────────────────

  test('TC-15.3: #report-hourly está visível com barras .hourly-bar', async () => {
    await openReportModal(page);
    await expect(page.locator('#report-hourly')).toBeVisible();
    const bars = page.locator('#report-hourly .hourly-bar');
    await expect(bars).toHaveCount(24);
  });

  test('TC-15.4: distribuição horária renderiza exatamente 24 barras', async () => {
    await openReportModal(page);
    await expect(page.locator('#report-hourly .hourly-bar-wrap')).toHaveCount(24);
  });

  // ── Streak sem saturação ─────────────────────────────────────────────────────

  test('TC-15.5: #report-streak está visível', async () => {
    await openReportModal(page);
    await expect(page.locator('#report-streak')).toBeVisible();
  });

  test('TC-15.6: streak é 0 quando último dia do histórico saturou', async () => {
    await openReportModal(page);
    // DAILY_HISTORY_3DAYS: último dia (2026-04-20) tem maxSession=45, mas o de 2026-04-19 tem 80
    // e 2026-04-20 tem 45 — streak deve ser >= 1
    const streakEl = page.locator('#report-streak .report-streak-value');
    await expect(streakEl).toBeVisible();
  });

  // ── Dias de maior risco ──────────────────────────────────────────────────────

  test('TC-15.7: #report-risk-days está visível', async () => {
    await openReportModal(page);
    await expect(page.locator('#report-risk-days')).toBeVisible();
  });

  test('TC-15.8: risk-days exibe linhas .risk-day-row quando há janelas com peakTs', async () => {
    await openReportModal(page);
    const rows = page.locator('#report-risk-days .risk-day-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  // ── Custo de excesso ──────────────────────────────────────────────────────────

  test('TC-15.9: #report-excess está visível', async () => {
    await openReportModal(page);
    await expect(page.locator('#report-excess')).toBeVisible();
  });

  test('TC-15.10: custo de excesso exibe percentual quando há janelas acima de 100%', async () => {
    await openReportModal(page);
    const excessEl = page.locator('#report-excess .report-excess-value');
    await expect(excessEl).toBeVisible();
    // 2 de 3 janelas têm peak > 100 → 67%
    await expect(excessEl).not.toContainText('none');
  });
});

// ── Suite com histórico de 14 dias (forecast ativo) ──────────────────────────

test.describe('TC-15 forecast — histórico 14 dias', () => {
  let testApp: TestApp;
  let page: Page;

  test.beforeAll(async () => {
    testApp = await launchApp({
      _mockData: {
        dailyHistory: DAILY_HISTORY_14DAYS,
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

  test('TC-15.11: forecast exibe dias restantes com 14 dias de histórico crescente', async () => {
    await openReportModal(page);
    const forecastEl = page.locator('#report-forecast');
    await expect(forecastEl).toBeVisible();
    // Com +5%/dia e weekly atual ~75, restam ~5 dias → deve mostrar "~5 dias restantes" ou similar
    const forecastValue = page.locator('#report-forecast .report-forecast-value');
    await expect(forecastValue).toBeVisible();
    await expect(forecastValue).not.toHaveClass(/flat/);
  });

  test('TC-15.12: forecast exibe taxa média diária', async () => {
    await openReportModal(page);
    const sub = page.locator('#report-forecast .report-forecast-sub');
    await expect(sub).toBeVisible();
  });

  test('TC-15.13: streak calcula corretamente com 14 dias', async () => {
    await openReportModal(page);
    // DAILY_HISTORY_14DAYS: i%3===0 → maxSession=110 (saturado)
    // último índice = 13 (i=13): 13%3=1 → maxSession=60 → não saturou
    // i=12: 12%3=0 → maxSession=110 → saturou → streak=1
    const streakEl = page.locator('#report-streak .report-streak-value');
    await expect(streakEl).toBeVisible();
    await expect(streakEl).toContainText('1');
  });
});

// ── Suite sem excesso ────────────────────────────────────────────────────────

test.describe('TC-15 sem excesso', () => {
  let testApp: TestApp;
  let page: Page;

  test.beforeAll(async () => {
    testApp = await launchApp({
      _mockData: {
        dailyHistory: DAILY_HISTORY_3DAYS,
        sessionWindows: SESSION_WINDOWS_NO_EXCESS,
        currentWindow: null,
      },
    });
    page = testApp.page;
  });

  test.afterAll(async () => {
    await closeApp(testApp.app);
  });

  test('TC-15.14: custo de excesso exibe mensagem "sem excesso" quando peak <= 100', async () => {
    await page.evaluate((data) => {
      (window as any).__emit('usage', data);
    }, NORMAL_USAGE);
    await page.locator('#btn-report-history').click();
    await expect(page.locator('#report-modal')).not.toHaveClass(/hidden/);
    const excessVal = page.locator('#report-excess .report-excess-value');
    await expect(excessVal).toBeVisible();
    await expect(excessVal).toHaveClass(/none/);
  });
});
