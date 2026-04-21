/**
 * TC-09.x — Smart Scheduler (5 estados semafóricos)
 * Regras: BR §5 — Matriz de Decisão Semafórica
 */
import { test, expect, type Page } from '@playwright/test';
import { launchApp, closeApp, type TestApp } from '../../helpers/electron-launch';

// Factories de SmartStatus para cada cor
function makeStatus(statusId: string, colorHex: string, usoSessao = 30, minutosParaReset = 120) {
  return {
    statusId,
    colorHex,
    messageKey: `smartPlan.status.${statusId}`,
    usoSessao,
    minutosAtuais: 10 * 60, // 10:00
    minutosParaReset,
    momentoDoReset: 10 * 60 + minutosParaReset,
    workStartMin: 8 * 60,
    workEndMin: 18 * 60,
    breakStartMin: 12 * 60,
    breakEndMin: 13 * 60,
    resetCrossesDay: false,
    enabled: true,
  };
}

const BLUE_STATUS   = { ...makeStatus('blue', '#3b82f6'), enabled: true, usoSessao: 0, minutosAtuais: 6 * 60 };
const GREEN_STATUS  = makeStatus('green', '#22c55e', 30);
const RED_STATUS    = makeStatus('red', '#ef4444', 90, 90);
const YELLOW_STATUS = makeStatus('yellow', '#eab308', 60, 30);
const PURPLE_STATUS = { ...makeStatus('purple', '#a855f7', 0), idealStartTime: '08:00' };

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
    const indicator = document.getElementById('smart-indicator');
    if (indicator) indicator.classList.add('hidden');
  });
});

async function emitStatus(p: Page, status: object) {
  await p.evaluate((s) => {
    (window as any).__emit('smartStatus', s);
  }, status);
}

async function openSmartModal(p: Page) {
  await p.locator('#smart-indicator:not(.hidden)').click();
  await expect(p.locator('#smart-scheduler-modal')).not.toHaveClass(/hidden/);
}

function hexToRgbPattern(hex: string): RegExp {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return new RegExp(`${hex}|rgb\\(${r},\\s*${g},\\s*${b}\\)`, 'i');
}

// TC-09.1 — AZUL: indicator dot tem cor azul
test('TC-09.1: AZUL — indicator dot tem cor #3b82f6', async () => {
  await emitStatus(page, BLUE_STATUS);
  await expect(page.locator('#smart-indicator')).not.toHaveClass(/hidden/);
  const dotColor = await page.locator('#smart-indicator .smart-indicator-dot').evaluate(
    el => (el as HTMLElement).style.background
  );
  expect(dotColor).toMatch(hexToRgbPattern('#3b82f6'));
});

// TC-09.2 — VERDE: indicator dot tem cor verde
test('TC-09.2: VERDE — indicator dot tem cor #22c55e', async () => {
  await emitStatus(page, GREEN_STATUS);
  await expect(page.locator('#smart-indicator')).not.toHaveClass(/hidden/);
  const dotColor = await page.locator('#smart-indicator .smart-indicator-dot').evaluate(
    el => (el as HTMLElement).style.background
  );
  expect(dotColor).toMatch(hexToRgbPattern('#22c55e'));
});

// TC-09.3 — VERDE: modal exibe cabeçalho com cor verde
test('TC-09.3: VERDE — modal header background é #22c55e', async () => {
  await emitStatus(page, GREEN_STATUS);
  await openSmartModal(page);
  const bg = await page.locator('#sp-verdict-header').evaluate(
    el => (el as HTMLElement).style.backgroundColor
  );
  // Pode vir como rgb() ou hex dependendo do browser
  expect(bg.toLowerCase()).toMatch(/22c55e|rgb\(34,\s*197,\s*94\)/);
});

// TC-09.4 — VERMELHO: indicator dot tem cor vermelha
test('TC-09.4: VERMELHO — indicator dot tem cor #ef4444', async () => {
  await emitStatus(page, RED_STATUS);
  await expect(page.locator('#smart-indicator')).not.toHaveClass(/hidden/);
  const dotColor = await page.locator('#smart-indicator .smart-indicator-dot').evaluate(
    el => (el as HTMLElement).style.background
  );
  expect(dotColor).toMatch(hexToRgbPattern('#ef4444'));
});

// TC-09.5 — AMARELO: indicator dot tem cor amarela
test('TC-09.5: AMARELO — indicator dot tem cor #eab308', async () => {
  await emitStatus(page, YELLOW_STATUS);
  await expect(page.locator('#smart-indicator')).not.toHaveClass(/hidden/);
  const dotColor = await page.locator('#smart-indicator .smart-indicator-dot').evaluate(
    el => (el as HTMLElement).style.background
  );
  expect(dotColor).toMatch(hexToRgbPattern('#eab308'));
});

// TC-09.6 — ROXO: indicator dot tem cor roxa
test('TC-09.6: ROXO — indicator dot tem cor #a855f7', async () => {
  await emitStatus(page, PURPLE_STATUS);
  await expect(page.locator('#smart-indicator')).not.toHaveClass(/hidden/);
  const dotColor = await page.locator('#smart-indicator .smart-indicator-dot').evaluate(
    el => (el as HTMLElement).style.background
  );
  expect(dotColor).toMatch(hexToRgbPattern('#a855f7'));
});

// TC-09.7 — Modal abre ao clicar no indicator
test('TC-09.7: clicar no indicator abre #smart-scheduler-modal', async () => {
  await emitStatus(page, GREEN_STATUS);
  await openSmartModal(page);
  // Verifica que é o modal completo (não popup inline)
  await expect(page.locator('.sp-timeline')).toBeVisible();
  await expect(page.locator('#sp-now-marker')).toBeAttached();
});

// TC-09.8 — Modal fecha com botão X
test('TC-09.8: botão X fecha o smart modal', async () => {
  await emitStatus(page, GREEN_STATUS);
  await openSmartModal(page);
  await page.locator('#sp-close-btn').dispatchEvent('click');
  await expect(page.locator('#smart-scheduler-modal')).toHaveClass(/hidden/);
});

// TC-09.9 — disabled=true oculta o indicator
test('TC-09.9: status disabled oculta o #smart-indicator', async () => {
  await page.evaluate(() => {
    (window as any).__emit('smartStatus', {
      statusId: 'blue', colorHex: '#3b82f6', messageKey: 'smartPlan.status.blue',
      usoSessao: 0, minutosAtuais: 600, minutosParaReset: 120, momentoDoReset: 720,
      workStartMin: 480, workEndMin: 1080, breakStartMin: 720, breakEndMin: 780,
      resetCrossesDay: false, enabled: false,
    });
  });
  await expect(page.locator('#smart-indicator')).toHaveClass(/hidden/);
});
