import { test, expect, type Page } from '@playwright/test';
import { launchApp, closeApp, type TestApp } from '../../helpers/electron-launch';
import { ptBrSettings } from '../../fixtures/settings';

// Suite EN — idioma padrão
let enApp: TestApp;
let enPage: Page;

test.describe('i18n — EN (padrão)', () => {
  test.beforeAll(async () => {
    enApp = await launchApp();
    enPage = enApp.page;
  });

  test.afterAll(async () => {
    await closeApp(enApp.app);
  });

  test('TC-10.1: idioma EN — nenhum [data-i18n] tem textContent vazio', async () => {
    const emptyI18n = await enPage.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[data-i18n]'));
      return els
        .filter((el) => !el.textContent?.trim())
        .map((el) => el.getAttribute('data-i18n'));
    });

    expect(emptyI18n).toHaveLength(0);
  });

  test('TC-10.3: idioma EN — label do gauge sessão existe e não está vazio', async () => {
    const labelText = await enPage.locator('[data-i18n="sessionLabel"]').first().textContent();
    expect(labelText?.trim().length).toBeGreaterThan(0);
  });
});

// Suite PT-BR — idioma alternativo
let ptApp: TestApp;
let ptPage: Page;

test.describe('i18n — PT-BR', () => {
  test.beforeAll(async () => {
    ptApp = await launchApp(ptBrSettings as unknown as Record<string, unknown>);
    ptPage = ptApp.page;
  });

  test.afterAll(async () => {
    await closeApp(ptApp.app);
  });

  test('TC-10.2: idioma PT-BR — nenhum [data-i18n] tem textContent vazio', async () => {
    const emptyI18n = await ptPage.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[data-i18n]'));
      return els
        .filter((el) => !el.textContent?.trim())
        .map((el) => el.getAttribute('data-i18n'));
    });

    expect(emptyI18n).toHaveLength(0);
  });
});
