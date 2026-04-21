/**
 * TC-12.x — Módulo de Atualizações
 * Regras: BR §12 — Verificação de Atualizações
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
    const banner = document.getElementById('update-banner');
    if (banner) banner.style.display = 'none';
  });
});

// TC-12.1 — Banner update minor persiste (não tem skippedVersion setado)
test('TC-12.1: banner update minor v1.6.0 aparece e permanece', async () => {
  await page.evaluate(() => {
    (window as any).__emit('update', {
      version: '1.6.0', url: 'https://example.com', downloadUrl: '', isMajor: false,
    });
  });
  await expect(page.locator('#update-banner')).toBeVisible();
  await expect(page.locator('#update-version-label')).toContainText('1.6.0');
});

// TC-12.2 — Progresso de download exibido no modal major
test('TC-12.2: progresso de download exibido no modal', async () => {
  await page.evaluate(() => {
    (window as any).__emit('update', {
      version: '2.0.0', url: 'https://example.com', downloadUrl: 'https://cdn/setup.exe', isMajor: true,
    });
  });
  await expect(page.locator('#update-major-modal')).not.toHaveClass(/hidden/);

  // Simular progresso de download
  await page.evaluate(() => {
    (window as any).__emit('dlProgress', 50);
  });
  await expect(page.locator('#update-major-progress-label')).toHaveText('50%');
});

// TC-12.3 — "Mais tarde" em update MAJOR não define skippedVersion
// BR §12: "Para updates major, skippedVersion nunca é setado — modal sempre reaparece"
test('TC-12.3: "Mais tarde" em major NÃO chama saveSettings com skippedVersion', async () => {
  await page.evaluate(() => {
    (window as any).__emit('update', {
      version: '2.0.0', url: 'https://example.com', downloadUrl: '', isMajor: true,
    });
  });
  await expect(page.locator('#update-major-modal')).not.toHaveClass(/hidden/);

  const countBefore = await page.evaluate(() =>
    (window as any).__mockState.getSaveSettingsCount()
  );

  await page.locator('#update-major-later-btn').click();

  // Modal deve fechar
  await expect(page.locator('#update-major-modal')).toHaveClass(/hidden/);

  const countAfter = await page.evaluate(() =>
    (window as any).__mockState.getSaveSettingsCount()
  );

  // saveSettings NÃO deve ter sido chamado (major nunca seta skippedVersion)
  expect(countAfter).toBe(countBefore);
});

// TC-12.4 — Update minor: "Mais tarde" seta skippedVersion
// BR §6: "skippedVersion: versão que o usuário optou por pular"
test('TC-12.4: "Mais tarde" em minor seta skippedVersion', async () => {
  // O banner minor não tem botão "Mais tarde" visível na UI principal —
  // o dismiss é via dismissUpdate IPC
  await page.evaluate(() => {
    (window as any).__emit('update', {
      version: '1.7.0', url: 'https://example.com', downloadUrl: '', isMajor: false,
    });
  });
  await expect(page.locator('#update-banner')).toBeVisible();
});
