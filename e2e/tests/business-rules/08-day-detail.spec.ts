/**
 * TC-07.x — Modal de Detalhe do Dia
 * Regras: BR §3 — "clique em .daily-col DEVE chamar openDayDetailModal"
 */
import { test, expect, type Page } from '@playwright/test';
import { launchApp, closeApp, type TestApp } from '../../helpers/electron-launch';
import { DAILY_HISTORY_3DAYS } from '../../fixtures/daily-history';
import { NORMAL_USAGE } from '../../fixtures/usage-data';

let testApp: TestApp;
let page: Page;

test.beforeAll(async () => {
  testApp = await launchApp({ _mockData: { dailyHistory: DAILY_HISTORY_3DAYS } });
  page = testApp.page;

  // Dispara onUsageUpdated para que lastWeeklyResetsAt seja setado e dailyChart.render() rode
  await page.evaluate((data) => {
    (window as any).__emit('usage', data);
  }, NORMAL_USAGE);

  // Aguarda o gráfico renderizar (.daily-col aparecer no DOM)
  await page.waitForSelector('.daily-col', { timeout: 5000 });
});

test.afterAll(async () => {
  await closeApp(testApp.app);
});

test.beforeEach(async () => {
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
  });
});

// TC-07.1 — Clique em .daily-col abre #day-detail-modal (não popup inline)
test('TC-07.1: clique em .daily-col abre #day-detail-modal (não popup inline)', async () => {
  // Clica na primeira coluna não-futura
  const col = page.locator('.daily-col:not(.future)').first();
  await expect(col).toBeVisible();
  await col.click();

  // Deve abrir o modal completo, não um popup inline
  await expect(page.locator('#day-detail-modal')).not.toHaveClass(/hidden/);
});

// TC-07.2 — Modal tem canvas do gráfico de linha
test('TC-07.2: modal de detalhe tem canvas do gráfico', async () => {
  const col = page.locator('.daily-col:not(.future)').first();
  await col.click();
  await expect(page.locator('#day-detail-modal')).not.toHaveClass(/hidden/);
  await expect(page.locator('#day-detail-canvas')).toBeAttached();
});

// TC-07.3 — Botão X fecha o modal
test('TC-07.3: botão X fecha #day-detail-modal', async () => {
  const col = page.locator('.daily-col:not(.future)').first();
  await col.click();
  await expect(page.locator('#day-detail-modal')).not.toHaveClass(/hidden/);

  await page.locator('#day-detail-close').click();
  await expect(page.locator('#day-detail-modal')).toHaveClass(/hidden/);
});
