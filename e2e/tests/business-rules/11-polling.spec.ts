/**
 * TC-13.x — Polling e Auto-Refresh
 * Regras: BR §2 — Coleta e Monitoramento
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
    // Limpar rate limit banner
    const banner = document.getElementById('rate-limit-banner');
    if (banner) banner.classList.remove('visible');
  });
});

// TC-13.1 — Durante rate limit, #btn-refresh abre modal de confirmação (triggerNow é no-op)
// BR §2: "triggerNow() → No-op se rate limited"
test('TC-13.1: durante rate limit, refresh abre modal de confirmação', async () => {
  await page.evaluate(() => {
    (window as any).__emit('rateLimited', Date.now() + 300000);
  });
  await expect(page.locator('#rate-limit-banner')).toHaveClass(/visible/);

  await page.locator('#btn-refresh').click();

  // Deve mostrar o modal de confirmação (não chamar refreshNow diretamente)
  await expect(page.locator('#force-refresh-modal')).not.toHaveClass(/hidden/);
});

// TC-13.2 — Confirmar forçar atualização chama forceRefreshNow
// BR §2: "forceNow() → Limpa estado de rate limit e executa"
test('TC-13.2: confirmar forçar atualização chama forceRefreshNow', async () => {
  await page.evaluate(() => {
    (window as any).__emit('rateLimited', Date.now() + 300000);
  });

  await page.locator('#btn-refresh').click();
  await expect(page.locator('#force-refresh-modal')).not.toHaveClass(/hidden/);

  const countBefore = await page.evaluate(() =>
    (window as any).__mockState.getForceRefreshCount()
  );

  await page.locator('#modal-confirm').click();

  const countAfter = await page.evaluate(() =>
    (window as any).__mockState.getForceRefreshCount()
  );
  expect(countAfter).toBeGreaterThan(countBefore);

  // Modal fecha após confirmar
  await expect(page.locator('#force-refresh-modal')).toHaveClass(/hidden/);
});

// TC-13.3 — Sem rate limit, #btn-refresh NÃO abre modal (chama refreshNow diretamente)
test('TC-13.3: sem rate limit, refresh não abre modal de confirmação', async () => {
  // Sem rate limit ativo
  await page.locator('#btn-refresh').click();

  // Modal de force-refresh NÃO deve aparecer
  const modalVisible = await page.evaluate(() => {
    const m = document.getElementById('force-refresh-modal');
    return m ? !m.classList.contains('hidden') : false;
  });
  expect(modalVisible).toBe(false);
});
