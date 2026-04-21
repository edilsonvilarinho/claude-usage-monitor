/**
 * TC-11.x — Cloud Sync
 * Regras: BR §7 — Sincronização em Nuvem
 */
import { test, expect, type Page } from '@playwright/test';
import { launchApp, closeApp, type TestApp } from '../../helpers/electron-launch';

// TC-11.1 — Setup form visível quando sync desabilitado (default)
test.describe('TC-11.1: sync desabilitado — setup form visível', () => {
  let testApp: TestApp;
  let page: Page;

  test.beforeAll(async () => {
    testApp = await launchApp(); // cloudSync.enabled: false (default)
    page = testApp.page;
  });
  test.afterAll(async () => { await closeApp(testApp.app); });

  test('formulário de setup cloud sync está presente', async () => {
    await page.locator('#btn-settings').click();
    await expect(page.locator('#settings-modal')).not.toHaveClass(/hidden/);
    await page.locator('[data-tab="tab-backup"]').click();

    // Setup form é visível quando sync está desabilitado
    await expect(page.locator('#cloud-sync-setup')).toBeVisible();
    await expect(page.locator('#sync-server-url')).toBeVisible();
    await expect(page.locator('#sync-device-label')).toBeVisible();
    await expect(page.locator('#btn-sync-enable')).toBeVisible();
  });
});

// TC-11.2 — Habilitar sync chama sync.enable()
test.describe('TC-11.2: habilitar sync chama sync.enable()', () => {
  let testApp: TestApp;
  let page: Page;

  test.beforeAll(async () => {
    testApp = await launchApp();
    page = testApp.page;
  });
  test.afterAll(async () => { await closeApp(testApp.app); });

  test('clicar em "Sign in & enable" chama sync.enable', async () => {
    await page.locator('#btn-settings').click();
    await page.locator('[data-tab="tab-backup"]').click();

    // Preencher formulário
    await page.locator('#sync-server-url').fill('http://localhost:3030');
    await page.locator('#sync-device-label').fill('test-pc');

    const countBefore = await page.evaluate(() =>
      (window as any).__mockState.getSyncEnableCount()
    );

    await page.locator('#btn-sync-enable').click();

    const countAfter = await page.evaluate(() =>
      (window as any).__mockState.getSyncEnableCount()
    );
    expect(countAfter).toBeGreaterThan(countBefore);
  });
});

// TC-11.5 — Desabilitar sync chama sync.disable()
test.describe('TC-11.5: desabilitar sync chama sync.disable()', () => {
  let testApp: TestApp;
  let page: Page;

  test.beforeAll(async () => {
    // Lançar com sync habilitado para que o painel de status apareça
    testApp = await launchApp({
      cloudSync: {
        enabled: true,
        serverUrl: 'http://localhost:3030',
        deviceId: 'test-uuid',
        deviceLabel: 'test-pc',
        lastSyncAt: Date.now(),
        lastSyncError: '',
        lastPullCursor: 0,
        syncIntervalMinutes: 15,
      },
    });
    page = testApp.page;
  });
  test.afterAll(async () => { await closeApp(testApp.app); });

  test('clicar em "Disable" chama sync.disable', async () => {
    await page.locator('#btn-settings').click();
    await page.locator('[data-tab="tab-backup"]').click();

    // Com sync habilitado, o painel de status deve estar visível
    await expect(page.locator('#cloud-sync-status')).toBeVisible();

    const countBefore = await page.evaluate(() =>
      (window as any).__mockState.getSyncDisableCount()
    );

    await page.locator('#btn-sync-disable').click();

    const countAfter = await page.evaluate(() =>
      (window as any).__mockState.getSyncDisableCount()
    );
    expect(countAfter).toBeGreaterThan(countBefore);
  });
});
