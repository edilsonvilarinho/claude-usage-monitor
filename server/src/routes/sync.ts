import { Hono } from 'hono';

export const syncRoute = new Hono();

// POST /sync/push — Fase 2
syncRoute.post('/push', (c) => {
  return c.json({ error: 'not_implemented' }, 501);
});

// GET /sync/pull — Fase 2
syncRoute.get('/pull', (c) => {
  return c.json({ error: 'not_implemented' }, 501);
});

// GET /sync/snapshot — Fase 2
syncRoute.get('/snapshot', (c) => {
  return c.json({ error: 'not_implemented' }, 501);
});

// DELETE /sync/account — Fase 2
syncRoute.delete('/account', (c) => {
  return c.json({ error: 'not_implemented' }, 501);
});
