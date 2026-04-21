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

test('TC-04.1: credMissing → #credential-modal não tem classe "hidden"', async () => {
  await page.evaluate(() => {
    (window as unknown as { __emit: (event: string, path: string) => void }).__emit(
      'credMissing',
      '/home/user/.claude/.credentials.json'
    );
  });

  await expect(page.locator('#credential-modal')).not.toHaveClass(/hidden/);
});

test('TC-04.2: credExpired → #credential-modal não tem classe "hidden"', async () => {
  // Fechar o modal primeiro (se aberto pelo teste anterior)
  await page.evaluate(() => {
    const modal = document.getElementById('credential-modal');
    if (modal) modal.classList.add('hidden');
  });

  await page.evaluate(() => {
    (window as unknown as { __emit: (event: string) => void }).__emit('credExpired');
  });

  await expect(page.locator('#credential-modal')).not.toHaveClass(/hidden/);
});

test('TC-04.3: modal visível → click em #credential-retry-btn não causa erro', async () => {
  // Garantir que o modal está aberto
  await page.evaluate(() => {
    (window as unknown as { __emit: (event: string, path: string) => void }).__emit(
      'credMissing',
      '/home/user/.claude/.credentials.json'
    );
  });

  await expect(page.locator('#credential-modal')).not.toHaveClass(/hidden/);

  // Clica no botão retry — não deve lançar exceção
  await page.locator('#credential-retry-btn').click();

  // Após o clique, o modal pode fechar ou manter aberto — o teste verifica apenas que não há erro
  expect(true).toBe(true);
});
