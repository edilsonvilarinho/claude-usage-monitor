/**
 * TC-16.x — CLI Sessions Analytics Module
 * Regras: SessionAnalytics KPIs, charts, SessionHealthCard, destroy/recreate
 */
import { test, expect, type Page } from '@playwright/test';
import { launchApp, closeApp, type TestApp } from '../../helpers/electron-launch';

const SESSION_28M: Record<string, unknown> = {
  sessionId: 'abc-saturated-session',
  toolName: 'Stop',
  ts: Date.now() - 5000,
  inputTokens: 500_000,
  outputTokens: 80_000,
  cacheReadTokens: 28_000_000,
  cacheCreationTokens: 500_000,
};

const SESSION_SMALL: Record<string, unknown> = {
  sessionId: 'xyz-small-session',
  toolName: 'Stop',
  ts: Date.now() - 10_000,
  inputTokens: 10_000,
  outputTokens: 5_000,
  cacheReadTokens: 50_000,
  cacheCreationTokens: 10_000,
};

const TURNS_28M = Array.from({ length: 15 }, (_, i) => ({
  ts: Date.now() - (15 - i) * 60_000,
  cacheReadTokens: Math.round((i + 1) * (28_000_000 / 15)),
  inputTokens: Math.round((i + 1) * (500_000 / 15)),
}));

const TURNS_SMALL = Array.from({ length: 5 }, (_, i) => ({
  ts: Date.now() - (5 - i) * 60_000,
  cacheReadTokens: Math.round((i + 1) * (50_000 / 5)),
  inputTokens: Math.round((i + 1) * (10_000 / 5)),
}));

async function openSessionDetail(page: Page, sessionIndex = 0): Promise<void> {
  await page.locator('#btn-cli-sessions').click();
  await expect(page.locator('#cli-sessions-modal')).not.toHaveClass(/hidden/);
  await page.locator('.cli-session-row').nth(sessionIndex).click();
  await expect(page.locator('#cli-sessions-detail')).not.toHaveClass(/hidden/);
}

// TC-16.1 — KPI cards renderizam com sessão grande (28M cache read)
test.describe('TC-16.1: KPI cards — sessão saturada 28M tokens', () => {
  let testApp: TestApp;
  let page: Page;

  test.beforeAll(async () => {
    testApp = await launchApp({
      _mockData: {
        cliSessions: [SESSION_28M],
        cliSessionTurns: TURNS_28M,
      },
    });
    page = testApp.page;
  });
  test.afterAll(async () => { await closeApp(testApp.app); });

  test('KPI grid visível após abrir detalhe', async () => {
    await openSessionDetail(page);
    await expect(page.locator('.cli-kpi-grid')).toBeVisible({ timeout: 5000 });
  });

  test('3 KPI cards presentes', async () => {
    await expect(page.locator('.cli-kpi-card')).toHaveCount(3);
  });

  test('SessionHealthCard visível (sessão saturada)', async () => {
    await expect(page.locator('.session-health-card.saturated')).toBeVisible();
  });

  test('Chart A canvas presente', async () => {
    await expect(page.locator('#cli-chart-trend')).toBeAttached({ timeout: 5000 });
  });

  test('Chart B canvas presente', async () => {
    await expect(page.locator('#cli-chart-efficiency')).toBeAttached({ timeout: 5000 });
  });

  test('cacheSavings KPI mostra valor positivo', async () => {
    const savingsCard = page.locator('.cli-kpi-card').nth(2);
    const text = await savingsCard.locator('.cli-kpi-value').textContent();
    expect(text).toMatch(/^\+\$/);
  });
});

// TC-16.2 — Sessão pequena não exibe SessionHealthCard
test.describe('TC-16.2: sessão pequena — sem health card', () => {
  let testApp: TestApp;
  let page: Page;

  test.beforeAll(async () => {
    testApp = await launchApp({
      _mockData: {
        cliSessions: [SESSION_SMALL],
        cliSessionTurns: TURNS_SMALL,
      },
    });
    page = testApp.page;
  });
  test.afterAll(async () => { await closeApp(testApp.app); });

  test('SessionHealthCard ausente para sessão pequena', async () => {
    await openSessionDetail(page);
    await expect(page.locator('.cli-kpi-grid')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.session-health-card.saturated')).toHaveCount(0);
  });
});

// TC-16.3 — Destroy/recreate ao trocar sessão (sem memory leak)
test.describe('TC-16.3: destroy/recreate ao trocar sessão', () => {
  let testApp: TestApp;
  let page: Page;

  test.beforeAll(async () => {
    testApp = await launchApp({
      _mockData: {
        cliSessions: [SESSION_28M, SESSION_SMALL],
        cliSessionTurns: TURNS_28M,
      },
    });
    page = testApp.page;
  });
  test.afterAll(async () => { await closeApp(testApp.app); });

  test('charts não duplicam ao trocar entre sessões', async () => {
    await openSessionDetail(page, 0);
    await expect(page.locator('.cli-kpi-grid')).toBeVisible({ timeout: 5000 });
    // Voltar para lista
    await page.locator('#cli-sessions-back').click();
    await expect(page.locator('#cli-sessions-list')).not.toHaveClass(/hidden/);
    // Abrir segunda sessão
    await page.locator('.cli-session-row').nth(1).click();
    await expect(page.locator('#cli-sessions-detail')).not.toHaveClass(/hidden/);
    await expect(page.locator('.cli-kpi-grid')).toBeVisible({ timeout: 5000 });
    // Apenas 1 instância de cada canvas (sem duplicata)
    await expect(page.locator('#cli-chart-trend')).toHaveCount(1);
    await expect(page.locator('#cli-chart-efficiency')).toHaveCount(1);
  });
});

// TC-16.4 — i18n pt-BR exibe labels corretos
test.describe('TC-16.4: i18n pt-BR nos labels de analytics', () => {
  let testApp: TestApp;
  let page: Page;

  test.beforeAll(async () => {
    testApp = await launchApp({
      language: 'pt-BR',
      _mockData: {
        cliSessions: [SESSION_28M],
        cliSessionTurns: TURNS_28M,
      },
    });
    page = testApp.page;
  });
  test.afterAll(async () => { await closeApp(testApp.app); });

  test('label "Contexto médio/turno" visível em pt-BR', async () => {
    await openSessionDetail(page);
    await expect(page.locator('.cli-kpi-grid')).toBeVisible({ timeout: 5000 });
    const labels = await page.locator('.cli-kpi-label').allTextContents();
    expect(labels.some(l => l.includes('Contexto médio'))).toBe(true);
  });
});
