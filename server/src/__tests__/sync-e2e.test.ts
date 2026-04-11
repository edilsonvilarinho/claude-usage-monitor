/**
 * Testes e2e de sync concorrente — simula 2 devices usando o app Hono in-process.
 *
 * - Banco SQLite em memória (sem arquivo em disco).
 * - validateAnthropicToken mockado: não bate na API real.
 * - app.fetch() chamado diretamente: sem servidor TCP.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mock de validateAnthropicToken ANTES de importar as rotas ---
vi.mock('../services/anthropicAuth', () => ({
  validateAnthropicToken: vi.fn().mockResolvedValue({ email: 'test@example.com' }),
}));

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { healthRoute } from '../routes/health';
import { authRoute } from '../routes/auth';
import { syncRoute } from '../routes/sync';
import { authGuard } from '../middleware/authGuard';
import { setDb, createInMemoryDb } from '../db/client';

// Monta o app sem rateLimit para simplificar os testes
function buildTestApp(): Hono {
  const app = new Hono();
  app.use('*', cors({ origin: '*' }));
  app.use('/sync/*', authGuard);
  app.route('/health', healthRoute);
  app.route('/auth', authRoute);
  app.route('/sync', syncRoute);
  return app;
}

// Helper: converte objeto em Request
function req(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Request {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, init);
}

// Helper: extrai JSON da Response do Hono
async function json<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  return JSON.parse(text) as T;
}

// ---------- Setup ----------

let app: Hono;

beforeEach(() => {
  // Banco isolado para cada teste — também reseta o JWT secret ephemeral
  process.env.JWT_SECRET = 'test-secret-for-e2e-tests-minimum-32-chars!!';
  const memDb = createInMemoryDb();
  setDb(memDb);
  app = buildTestApp();
});

// ---------- Constantes ----------

const DEVICE_A = 'device-a-uuid';
const DEVICE_B = 'device-b-uuid';
const DATE = '2026-04-10';
// resetsAt com precisão de minuto para dedup de sessionWindows
const RESETS_AT_ISO = '2026-04-10T08:00:00.000Z';
const RESETS_AT_MINUTE = Math.floor(new Date(RESETS_AT_ISO).getTime() / 60000);

// ---------- Helpers de autenticação ----------

async function exchangeToken(app: Hono, deviceId: string, deviceLabel: string): Promise<string> {
  const res = await app.fetch(
    req('POST', '/auth/exchange', {
      accessToken: 'fake-oauth-token',
      deviceId,
      deviceLabel,
    }),
  );
  if (res.status !== 200) {
    const body = await res.text();
    throw new Error(`Auth exchange failed (${res.status}): ${body}`);
  }
  const body = (await json(res)) as { jwt: string };
  return body.jwt;
}

function authHeader(jwt: string): Record<string, string> {
  return { Authorization: `Bearer ${jwt}` };
}

// Helper para fazer push com deviceId obrigatório
function pushBody(deviceId: string, overrides: {
  daily?: unknown[];
  sessionWindows?: unknown[];
  timeSeries?: unknown[];
  usageSnapshots?: unknown[];
  currentWindow?: unknown;
  settings?: unknown;
} = {}): unknown {
  return {
    deviceId,
    daily: overrides.daily ?? [],
    sessionWindows: overrides.sessionWindows ?? [],
    timeSeries: overrides.timeSeries ?? [],
    usageSnapshots: overrides.usageSnapshots ?? [],
    ...(overrides.currentWindow !== undefined ? { currentWindow: overrides.currentWindow } : {}),
    ...(overrides.settings !== undefined ? { settings: overrides.settings } : {}),
  };
}

// ==========================================================================
// Teste 1 — dailySnapshot max-merge: Device B com maxWeekly maior vence
// ==========================================================================
describe('CRDT max-merge em dailySnapshot', () => {
  it('pull do Device A recebe maxWeekly=80 após Device B fazer push com valor maior', async () => {
    const jwtA = await exchangeToken(app, DEVICE_A, 'Laptop');
    const jwtB = await exchangeToken(app, DEVICE_B, 'Desktop');

    // Device A push maxWeekly=50
    const pushA = await app.fetch(
      req(
        'POST',
        '/sync/push',
        pushBody(DEVICE_A, {
          daily: [
            {
              date: DATE,
              maxWeekly: 50,
              maxSession: 30,
              sessionWindowCount: 1,
              sessionAccum: 30,
              updatedAt: Date.now() - 2000,
              updatedByDevice: DEVICE_A,
            },
          ],
        }),
        authHeader(jwtA),
      ),
    );
    if (pushA.status !== 200) {
      const body = await pushA.text();
      throw new Error(`Push A failed (${pushA.status}): ${body}`);
    }
    expect(pushA.status).toBe(200);

    // Device B push maxWeekly=80
    const pushB = await app.fetch(
      req(
        'POST',
        '/sync/push',
        pushBody(DEVICE_B, {
          daily: [
            {
              date: DATE,
              maxWeekly: 80,
              maxSession: 20,
              sessionWindowCount: 1,
              sessionAccum: 20,
              updatedAt: Date.now() - 1000,
              updatedByDevice: DEVICE_B,
            },
          ],
        }),
        authHeader(jwtB),
      ),
    );
    expect(pushB.status).toBe(200);

    // Device A pull — deve ver maxWeekly=80 (max dos dois)
    const pullA = await app.fetch(req('GET', '/sync/pull', undefined, authHeader(jwtA)));
    expect(pullA.status).toBe(200);
    const body = (await json(pullA)) as {
      daily: Array<{ date: string; maxWeekly: number; maxSession: number }>;
    };

    expect(body.daily).toHaveLength(1);
    expect(body.daily[0].date).toBe(DATE);
    expect(body.daily[0].maxWeekly).toBe(80);
    // maxSession deve ser o maior dos dois (30)
    expect(body.daily[0].maxSession).toBe(30);
  });
});

// ==========================================================================
// Teste 2 — sessionWindow max-merge: peak máximo vence na colisão por minuto
// ==========================================================================
describe('CRDT max-merge em sessionWindow', () => {
  it('pull retorna peak=70 após Device A (peak=40) e Device B (peak=70) enviarem mesmo minuto', async () => {
    const jwtA = await exchangeToken(app, DEVICE_A, 'Laptop');
    const jwtB = await exchangeToken(app, DEVICE_B, 'Desktop');

    // Device A push sessionWindow peak=40
    const pushA = await app.fetch(
      req(
        'POST',
        '/sync/push',
        pushBody(DEVICE_A, {
          sessionWindows: [
            {
              date: DATE,
              resetsAt: RESETS_AT_ISO,
              resetsAtMinute: RESETS_AT_MINUTE,
              peak: 40,
              updatedAt: Date.now() - 2000,
            },
          ],
        }),
        authHeader(jwtA),
      ),
    );
    if (pushA.status !== 200) {
      const body = await pushA.text();
      throw new Error(`Push A sessionWindow failed (${pushA.status}): ${body}`);
    }

    // Device B push sessionWindow peak=70 (mesmo minuto)
    const pushB = await app.fetch(
      req(
        'POST',
        '/sync/push',
        pushBody(DEVICE_B, {
          sessionWindows: [
            {
              date: DATE,
              resetsAt: RESETS_AT_ISO,
              resetsAtMinute: RESETS_AT_MINUTE,
              peak: 70,
              updatedAt: Date.now() - 1000,
            },
          ],
        }),
        authHeader(jwtB),
      ),
    );
    expect(pushB.status).toBe(200);

    // Pull em qualquer device deve retornar peak=70
    const pullA = await app.fetch(req('GET', '/sync/pull', undefined, authHeader(jwtA)));
    expect(pullA.status).toBe(200);
    const body = (await json(pullA)) as {
      sessionWindows: Array<{ peak: number; resetsAtMinute: number }>;
    };

    expect(body.sessionWindows).toHaveLength(1);
    expect(body.sessionWindows[0].peak).toBe(70);
    expect(body.sessionWindows[0].resetsAtMinute).toBe(RESETS_AT_MINUTE);
  });
});

// ==========================================================================
// Teste 3 — timeSeries set-union: pontos de A e B são preservados e ordenados
// ==========================================================================
describe('timeSeries set-union', () => {
  it('pull retorna ambos os pontos após pushes de A e B, ts1 < ts2', async () => {
    const jwtA = await exchangeToken(app, DEVICE_A, 'Laptop');
    const jwtB = await exchangeToken(app, DEVICE_B, 'Desktop');

    const ts1 = 1744243200000; // ts fixo para A
    const ts2 = 1744243260000; // ts fixo para B (1 minuto depois)

    // Device A push ts1
    const pA = await app.fetch(
      req(
        'POST',
        '/sync/push',
        pushBody(DEVICE_A, {
          timeSeries: [{ ts: ts1, date: DATE, session: 10, weekly: 20 }],
        }),
        authHeader(jwtA),
      ),
    );
    if (pA.status !== 200) {
      throw new Error(`Push A timeSeries failed (${pA.status}): ${await pA.text()}`);
    }

    // Device B push ts2
    const pB = await app.fetch(
      req(
        'POST',
        '/sync/push',
        pushBody(DEVICE_B, {
          timeSeries: [{ ts: ts2, date: DATE, session: 20, weekly: 40 }],
        }),
        authHeader(jwtB),
      ),
    );
    expect(pB.status).toBe(200);

    // Pull deve retornar ambos
    const pull = await app.fetch(req('GET', '/sync/pull', undefined, authHeader(jwtA)));
    expect(pull.status).toBe(200);
    const body = (await json(pull)) as {
      timeSeries: Array<{ ts: number; session: number }>;
    };

    expect(body.timeSeries.length).toBeGreaterThanOrEqual(2);

    const sorted = [...body.timeSeries].sort((a, b) => a.ts - b.ts);
    const ts1Point = sorted.find((p) => p.ts === ts1);
    const ts2Point = sorted.find((p) => p.ts === ts2);

    expect(ts1Point).toBeDefined();
    expect(ts1Point?.session).toBe(10);
    expect(ts2Point).toBeDefined();
    expect(ts2Point?.session).toBe(20);
    // Ordenado: ts1 < ts2
    expect(sorted[0].ts).toBeLessThan(sorted[sorted.length - 1].ts);
  });
});

// ==========================================================================
// Teste 4 — pull incremental via ?since=<ts> só traz delta novo
// ==========================================================================
describe('pull incremental com ?since=<ts>', () => {
  it('?since=<ts> retorna apenas dados atualizados após o cursor', async () => {
    const jwtA = await exchangeToken(app, DEVICE_A, 'Laptop');

    // Push com updatedAt no passado
    const pastTs = Date.now() - 10000;
    const p1 = await app.fetch(
      req(
        'POST',
        '/sync/push',
        pushBody(DEVICE_A, {
          daily: [
            {
              date: '2026-04-09',
              maxWeekly: 30,
              maxSession: 15,
              sessionWindowCount: 1,
              sessionAccum: 15,
              updatedAt: pastTs,
              updatedByDevice: DEVICE_A,
            },
          ],
        }),
        authHeader(jwtA),
      ),
    );
    if (p1.status !== 200) {
      throw new Error(`Push 1 failed (${p1.status}): ${await p1.text()}`);
    }

    // Cursor agora — tudo anterior a esse ponto deve ser filtrado
    const cursor = Date.now();

    // Push de um segundo snapshot com updatedAt DEPOIS do cursor
    const futureTs = cursor + 5000;
    const p2 = await app.fetch(
      req(
        'POST',
        '/sync/push',
        pushBody(DEVICE_A, {
          daily: [
            {
              date: DATE,
              maxWeekly: 60,
              maxSession: 25,
              sessionWindowCount: 2,
              sessionAccum: 50,
              updatedAt: futureTs,
              updatedByDevice: DEVICE_A,
            },
          ],
        }),
        authHeader(jwtA),
      ),
    );
    expect(p2.status).toBe(200);

    // Pull incremental: since=cursor — só deve trazer o snapshot do DATE
    const pull = await app.fetch(
      req('GET', `/sync/pull?since=${cursor}`, undefined, authHeader(jwtA)),
    );
    expect(pull.status).toBe(200);
    const body = (await json(pull)) as { daily: Array<{ date: string }> };

    const dates = body.daily.map((d) => d.date);
    expect(dates).toContain(DATE);
    expect(dates).not.toContain('2026-04-09');
  });
});

// ==========================================================================
// Teste 5 — autenticação: dois devices independentes com mesmo email
// ==========================================================================
describe('autenticação de dois devices com mesmo email', () => {
  it('Device A e Device B recebem JWTs distintos mas compartilham dados do mesmo email', async () => {
    const jwtA = await exchangeToken(app, DEVICE_A, 'Laptop');
    const jwtB = await exchangeToken(app, DEVICE_B, 'Desktop');

    // JWTs devem ser strings não-vazias e diferentes entre si
    expect(typeof jwtA).toBe('string');
    expect(jwtA.length).toBeGreaterThan(10);
    expect(typeof jwtB).toBe('string');
    expect(jwtA).not.toBe(jwtB);

    // Device A faz push
    const pushRes = await app.fetch(
      req(
        'POST',
        '/sync/push',
        pushBody(DEVICE_A, {
          daily: [
            {
              date: DATE,
              maxWeekly: 100,
              maxSession: 50,
              sessionWindowCount: 1,
              sessionAccum: 50,
              updatedAt: Date.now(),
              updatedByDevice: DEVICE_A,
            },
          ],
        }),
        authHeader(jwtA),
      ),
    );
    if (pushRes.status !== 200) {
      throw new Error(`Push failed (${pushRes.status}): ${await pushRes.text()}`);
    }
    expect(pushRes.status).toBe(200);

    // Device B faz pull — deve ver os dados de Device A (mesmo email)
    const pullB = await app.fetch(req('GET', '/sync/pull', undefined, authHeader(jwtB)));
    expect(pullB.status).toBe(200);
    const body = (await json(pullB)) as { daily: Array<{ maxWeekly: number }> };
    expect(body.daily).toHaveLength(1);
    expect(body.daily[0].maxWeekly).toBe(100);
  });
});
