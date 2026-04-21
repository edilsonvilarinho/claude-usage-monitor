import { test, expect, type Page } from '@playwright/test';
import { launchApp, closeApp, type TestApp } from '../../helpers/electron-launch';
import { NORMAL_USAGE, OVER_100_USAGE } from '../../fixtures/usage-data';

let testApp: TestApp;
let page: Page;

test.beforeAll(async () => {
  testApp = await launchApp();
  page = testApp.page;
});

test.afterAll(async () => {
  await closeApp(testApp.app);
});

test('TC-01.1: onUsageUpdated com session=45 exibe "45%" em #pct-session', async () => {
  await page.evaluate((data) => {
    (window as unknown as { __emit: (event: string, data: unknown) => void }).__emit('usage', data);
  }, NORMAL_USAGE);

  await expect(page.locator('#pct-session')).toHaveText('45%');
});

test('TC-01.2: onUsageUpdated com weekly=72 exibe "72%" em #pct-weekly', async () => {
  await page.evaluate((data) => {
    (window as unknown as { __emit: (event: string, data: unknown) => void }).__emit('usage', data);
  }, NORMAL_USAGE);

  await expect(page.locator('#pct-weekly')).toHaveText('72%');
});

test('TC-01.3: onUsageUpdated com session=1600 exibe "1600%" em #pct-session', async () => {
  await page.evaluate((data) => {
    (window as unknown as { __emit: (event: string, data: unknown) => void }).__emit('usage', data);
  }, OVER_100_USAGE);

  const text = await page.locator('#pct-session').textContent();
  expect(text).toContain('1600%');
});

test('TC-01.4: canvas #gauge-session e #gauge-weekly existem no DOM ao iniciar', async () => {
  await expect(page.locator('#gauge-session')).toBeAttached();
  await expect(page.locator('#gauge-weekly')).toBeAttached();
});
