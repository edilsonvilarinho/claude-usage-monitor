import { Hono } from 'hono';

export const authRoute = new Hono();

// POST /auth/exchange
// Fase 2: validar accessToken contra api.anthropic.com e devolver JWT próprio
authRoute.post('/exchange', (c) => {
  return c.json({ error: 'not_implemented' }, 501);
});
