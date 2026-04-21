import { test, expect, type Page } from '@playwright/test';
import { launchApp, closeApp, type TestApp } from '../../helpers/electron-launch';

let testApp: TestApp;
let page: Page;

test.beforeAll(async () => {
  testApp = await launchApp();
  page = testApp.page;
});

test.afterAll(async () => {
  await closeApp(testApp.app);
});

// Fechar todos os modais abertos antes de cada teste
test.beforeEach(async () => {
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay').forEach((m) => {
      m.classList.add('hidden');
    });
  });
});

test('TC-02.1: click em #btn-settings abre #settings-modal', async () => {
  await page.locator('#btn-settings').click();
  await expect(page.locator('#settings-modal')).not.toHaveClass(/hidden/);
});

test('TC-02.2: click em #btn-cost abre #cost-modal', async () => {
  await page.locator('#btn-cost').click();
  await expect(page.locator('#cost-modal')).not.toHaveClass(/hidden/);
});

test('TC-02.3: click em #btn-close chama closeWindow()', async () => {
  await page.locator('#btn-close').click();

  const wasCalled = await page.evaluate(() => {
    return (window as unknown as { __mockState: { getCloseWindowCount: () => number } }).__mockState.getCloseWindowCount() > 0;
  });

  expect(wasCalled).toBe(true);
});
