/**
 * TC-05.x — Modal de Configurações
 * Regras: BR §6 Persistência, §9 Interface e UX
 */
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

test.beforeEach(async () => {
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
  });
  await page.locator('#btn-settings').click();
  await expect(page.locator('#settings-modal')).not.toHaveClass(/hidden/);
  // Garante que o tab-geral está ativo antes de cada teste
  await page.locator('[data-tab="tab-geral"]').click();
});

// TC-05.1 — Modal tem 5 abas
test('TC-05.1: settings-modal tem 5 abas', async () => {
  const tabs = page.locator('[data-tab]');
  await expect(tabs).toHaveCount(5);
  await expect(page.locator('[data-tab="tab-geral"]')).toBeVisible();
  await expect(page.locator('[data-tab="tab-exibicao"]')).toBeVisible();
  await expect(page.locator('[data-tab="tab-notif"]')).toBeVisible();
  await expect(page.locator('[data-tab="tab-backup"]')).toBeVisible();
  await expect(page.locator('[data-tab="tab-smart-plan"]')).toBeVisible();
});

// TC-05.2 — Trocar tema dispara saveSettings
test('TC-05.2: trocar tema dispara saveSettings', async () => {
  const countBefore = await page.evaluate(() =>
    (window as any).__mockState.getSaveSettingsCount()
  );
  await page.locator('#setting-theme').selectOption('light');
  const countAfter = await page.evaluate(() =>
    (window as any).__mockState.getSaveSettingsCount()
  );
  expect(countAfter).toBeGreaterThan(countBefore);
});

// TC-05.3 — Trocar idioma para pt-BR dispara saveSettings
test('TC-05.3: trocar idioma para pt-BR dispara saveSettings', async () => {
  const countBefore = await page.evaluate(() =>
    (window as any).__mockState.getSaveSettingsCount()
  );
  await page.locator('#setting-language').selectOption('pt-BR');
  const countAfter = await page.evaluate(() =>
    (window as any).__mockState.getSaveSettingsCount()
  );
  expect(countAfter).toBeGreaterThan(countBefore);
});

// TC-05.4 — Threshold de sessão dispara saveSettings
test('TC-05.4: threshold de sessão dispara saveSettings', async () => {
  await page.locator('[data-tab="tab-notif"]').click();
  const countBefore = await page.evaluate(() =>
    (window as any).__mockState.getSaveSettingsCount()
  );
  await page.locator('#setting-session-threshold').fill('90');
  await page.locator('#setting-session-threshold').dispatchEvent('change');
  const countAfter = await page.evaluate(() =>
    (window as any).__mockState.getSaveSettingsCount()
  );
  expect(countAfter).toBeGreaterThan(countBefore);
});

// TC-05.5 — Master switch notificações dispara saveSettings
test('TC-05.5: master switch notificações dispara saveSettings', async () => {
  await page.locator('[data-tab="tab-notif"]').click();
  const countBefore = await page.evaluate(() =>
    (window as any).__mockState.getSaveSettingsCount()
  );
  await page.locator('#setting-notif-enabled').dispatchEvent('click');
  const countAfter = await page.evaluate(() =>
    (window as any).__mockState.getSaveSettingsCount()
  );
  expect(countAfter).toBeGreaterThan(countBefore);
});

// TC-05.7 — autoBackupMode dispara saveSettings
test('TC-05.7: trocar autoBackupMode dispara saveSettings', async () => {
  await page.locator('[data-tab="tab-backup"]').click();
  const countBefore = await page.evaluate(() =>
    (window as any).__mockState.getSaveSettingsCount()
  );
  await page.locator('#setting-auto-backup-mode').selectOption('after');
  const countAfter = await page.evaluate(() =>
    (window as any).__mockState.getSaveSettingsCount()
  );
  expect(countAfter).toBeGreaterThan(countBefore);
});

// TC-05.8 — Botão "Escolher pasta" chama chooseAutoBackupFolder
test('TC-05.8: botão escolher pasta chama chooseAutoBackupFolder', async () => {
  await page.locator('[data-tab="tab-backup"]').click();
  const countBefore = await page.evaluate(() =>
    (window as any).__mockState.getChooseBackupFolderCount()
  );
  await page.locator('#btn-auto-backup-folder').click();
  const countAfter = await page.evaluate(() =>
    (window as any).__mockState.getChooseBackupFolderCount()
  );
  expect(countAfter).toBeGreaterThan(countBefore);
});

// TC-05.6 — compactMode dispara saveSettings
test('TC-05.6: compact mode dispara saveSettings', async () => {
  const countBefore = await page.evaluate(() =>
    (window as any).__mockState.getSaveSettingsCount()
  );
  await page.locator('#setting-compact-mode').dispatchEvent('click');
  const countAfter = await page.evaluate(() =>
    (window as any).__mockState.getSaveSettingsCount()
  );
  expect(countAfter).toBeGreaterThan(countBefore);
});
