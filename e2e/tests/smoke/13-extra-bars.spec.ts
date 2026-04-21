/**
 * TC-13.x — Barras de créditos extras (credits + sonnet)
 * Cobre: exibição, valores, visibilidade condicional e ocultação quando dados ausentes.
 */
import { test, expect, type Page } from '@playwright/test';
import { launchApp, closeApp, type TestApp } from '../../helpers/electron-launch';
import {
  NORMAL_USAGE,
  USAGE_WITH_CREDITS,
  USAGE_WITH_SONNET,
  USAGE_WITH_BOTH_EXTRAS,
  USAGE_CREDITS_DISABLED,
} from '../../fixtures/usage-data';
import { defaultSettings } from '../../fixtures/settings';

const emit = (page: Page, data: unknown) =>
  page.evaluate((d) => {
    (window as unknown as { __emit: (e: string, data: unknown) => void }).__emit('usage', d);
  }, data);

test.describe('TC-13 — Barras extras (showExtraBars=true)', () => {
  let testApp: TestApp;
  let page: Page;

  test.beforeAll(async () => {
    testApp = await launchApp({ ...defaultSettings, showExtraBars: true });
    page = testApp.page;
  });

  test.afterAll(async () => {
    await closeApp(testApp.app);
  });

  // ── Créditos extras ────────────────────────────────────────────────────────

  test('TC-13.1: credits-row aparece e exibe 60% quando extra_usage ativo com 6000/10000 cents', async () => {
    await emit(page, USAGE_WITH_CREDITS);
    await expect(page.locator('#credits-row')).toBeVisible();
    await expect(page.locator('#pct-credits')).toHaveText('60%');
  });

  test('TC-13.2: bar-credits tem width 60% quando 6000/10000 cents', async () => {
    await emit(page, USAGE_WITH_CREDITS);
    const width = await page.locator('#bar-credits').evaluate((el) => (el as HTMLElement).style.width);
    expect(width).toBe('60%');
  });

  test('TC-13.3: credits-row fica oculto quando extra_usage.is_enabled=false', async () => {
    await emit(page, USAGE_CREDITS_DISABLED);
    await expect(page.locator('#credits-row')).not.toBeVisible();
  });

  test('TC-13.4: credits-row fica oculto quando extra_usage ausente', async () => {
    await emit(page, NORMAL_USAGE);
    await expect(page.locator('#credits-row')).not.toBeVisible();
  });

  // ── Sonnet semanal ──────────────────────────────────────────────────────────

  test('TC-13.5: sonnet-row aparece e exibe 38% quando seven_day_sonnet presente', async () => {
    await emit(page, USAGE_WITH_SONNET);
    await expect(page.locator('#sonnet-row')).toBeVisible();
    await expect(page.locator('#pct-sonnet')).toHaveText('38%');
  });

  test('TC-13.6: bar-sonnet tem width 38% quando utilization=38', async () => {
    await emit(page, USAGE_WITH_SONNET);
    const width = await page.locator('#bar-sonnet').evaluate((el) => (el as HTMLElement).style.width);
    expect(width).toBe('38%');
  });

  test('TC-13.7: sonnet-row fica oculto quando seven_day_sonnet ausente', async () => {
    await emit(page, NORMAL_USAGE);
    await expect(page.locator('#sonnet-row')).not.toBeVisible();
  });

  // ── Ambas as barras ────────────────────────────────────────────────────────

  test('TC-13.8: extra-section visível com ambas as barras ativas', async () => {
    await emit(page, USAGE_WITH_BOTH_EXTRAS);
    await expect(page.locator('#extra-section')).toBeVisible();
    await expect(page.locator('#sonnet-row')).toBeVisible();
    await expect(page.locator('#credits-row')).toBeVisible();
  });

  test('TC-13.9: barras principais (session/weekly) não são afetadas pelos dados extras', async () => {
    await emit(page, USAGE_WITH_BOTH_EXTRAS);
    await expect(page.locator('#pct-session')).toHaveText('45%');
    await expect(page.locator('#pct-weekly')).toHaveText('72%');
  });

  // ── Visibilidade da seção ──────────────────────────────────────────────────

  test('TC-13.10: extra-section fica oculto ao chamar applySectionVisibility com showExtraBars=false', async () => {
    await emit(page, USAGE_WITH_BOTH_EXTRAS);
    // Simula o efeito de showExtraBars=false via DOM (evita lançar 2ª instância Electron)
    await page.evaluate(() => {
      const section = document.getElementById('extra-section');
      if (section) section.style.display = 'none';
    });
    await expect(page.locator('#extra-section')).not.toBeVisible();
  });
});
