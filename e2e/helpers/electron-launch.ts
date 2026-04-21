import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';

const ROOT = path.join(__dirname, '../..');

export interface TestApp {
  app: ElectronApplication;
  page: Page;
}

/**
 * Inicia o Electron em modo de teste.
 *
 * Com NODE_ENV=test, o main.ts usa preload-test.js que expõe o mock diretamente
 * via contextBridge — impossível de ser sobrescrito de outra forma.
 *
 * As settings são passadas via --test-settings=<base64(JSON)>.
 */
export async function launchApp(settingsOverride?: Record<string, unknown>): Promise<TestApp> {
  const args = [path.join(ROOT, 'dist/main.js')];

  if (settingsOverride && Object.keys(settingsOverride).length > 0) {
    const b64 = Buffer.from(JSON.stringify(settingsOverride)).toString('base64');
    args.push(`--test-settings=${b64}`);
  }

  const app = await electron.launch({
    args,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_DISABLE_SANDBOX: '1',
    },
  });

  const page = await app.firstWindow();

  // A janela começa hidden no main.ts — mostrar explicitamente
  await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.show();
  });

  await page.waitForLoadState('domcontentloaded');

  return { app, page };
}

export async function closeApp(app: ElectronApplication): Promise<void> {
  await app.close();
}
