/**
 * TC-06.x — Modal de Custo Estimado
 * Regras: BR §8 Custo Estimado
 */
import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { launchApp, closeApp } from '../../helpers/electron-launch';
import { COST_GREEN, COST_YELLOW, COST_RED } from '../../fixtures/cost-estimate';

// TC-06.1 — Modal abre, 3 tabs, aviso estimativa presente
test.describe('TC-06.1: estrutura do modal de custo', () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ app, page } = await launchApp({ _mockData: { costEstimate: COST_GREEN } }));
  });
  test.afterAll(async () => { await closeApp(app); });

  test.beforeEach(async () => {
    await page.evaluate(() => {
      document.getElementById('cost-modal')?.classList.add('hidden');
    });
  });

  test('modal abre ao clicar #btn-cost', async () => {
    await page.locator('#btn-cost').click();
    await expect(page.locator('#cost-modal')).not.toHaveClass(/hidden/);
  });

  test('3 abas presentes: Session, Weekly, Monthly', async () => {
    await page.locator('#btn-cost').click();
    await expect(page.locator('.cost-tab[data-cost-tab="session"]')).toBeVisible();
    await expect(page.locator('.cost-tab[data-cost-tab="weekly"]')).toBeVisible();
    await expect(page.locator('.cost-tab[data-cost-tab="monthly"]')).toBeVisible();
  });

  test('aviso de estimativa está visível', async () => {
    await page.locator('#btn-cost').click();
    await expect(page.locator('.cost-warning')).toBeVisible();
  });
});

// TC-06.2 — Budget gauge: percentual verde (< 50%)
test.describe('TC-06.2: budget 40% exibe percentual correto', () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ app, page } = await launchApp({ _mockData: { costEstimate: COST_GREEN } }));
  });
  test.afterAll(async () => { await closeApp(app); });

  test('aba Monthly mostra 40% de budget utilizado', async () => {
    const costData = await page.evaluate(async () => (window as any).claudeUsage.getCostEstimate());
    console.log('[DEBUG] getCostEstimate direto:', JSON.stringify(costData)?.slice(0, 100));
    await page.locator('#btn-cost').click();
    await page.locator('.cost-tab[data-cost-tab="monthly"]').click();
    await expect(page.locator('#cost-monthly-pct')).toHaveText('40');
  });
});

// TC-06.3 — Budget gauge: percentual amarelo (50–80%)
test.describe('TC-06.3: budget 65% exibe percentual correto', () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ app, page } = await launchApp({ _mockData: { costEstimate: COST_YELLOW } }));
  });
  test.afterAll(async () => { await closeApp(app); });

  test('aba Monthly mostra 65% de budget utilizado', async () => {
    await page.locator('#btn-cost').click();
    await page.locator('.cost-tab[data-cost-tab="monthly"]').click();
    await expect(page.locator('#cost-monthly-pct')).toHaveText('65');
  });
});

// TC-06.4 — Budget gauge: percentual vermelho (> 80%)
test.describe('TC-06.4: budget 90% exibe percentual correto', () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ app, page } = await launchApp({ _mockData: { costEstimate: COST_RED } }));
  });
  test.afterAll(async () => { await closeApp(app); });

  test('aba Monthly mostra 90% de budget utilizado', async () => {
    await page.locator('#btn-cost').click();
    await page.locator('.cost-tab[data-cost-tab="monthly"]').click();
    await expect(page.locator('#cost-monthly-pct')).toHaveText('90');
  });
});

// TC-06.5 — Trocar modelo de custo chama saveSettings
test.describe('TC-06.5: trocar modelo chama saveSettings', () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ app, page } = await launchApp({ _mockData: { costEstimate: COST_GREEN } }));
  });
  test.afterAll(async () => { await closeApp(app); });

  test('clicar em Opus chama saveSettings com costModel opus', async () => {
    await page.locator('#btn-cost').click();
    await page.locator('.cost-model-btn[data-model="opus"]').click();
    const last = await page.evaluate(() =>
      (window as any).__mockState.getLastSaveSettings()
    );
    expect(last).toMatchObject({ costModel: 'opus' });
  });
});
