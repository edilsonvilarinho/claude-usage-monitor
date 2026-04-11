import { Hono } from 'hono';
import { AuthExchangeRequestSchema } from '@claude-usage/shared';
import { validateAnthropicToken } from '../services/anthropicAuth';
import { signJwt } from '../services/jwt';
import { getDb } from '../db/client';
import { logger } from '../logger';

export const authRoute = new Hono();

authRoute.post('/exchange', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  const parsed = AuthExchangeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }

  const { accessToken, deviceId, deviceLabel } = parsed.data;

  let email: string;
  try {
    const result = await validateAnthropicToken(accessToken);
    email = result.email;
  } catch (err) {
    logger.warn({ err }, 'Token validation failed');
    return c.json({ error: 'unauthorized' }, 401);
  }

  const now = Date.now();
  const db = getDb();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO users (email, created_at, last_seen_at)
       VALUES (?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
    ).run(email, now, now);

    db.prepare(
      `INSERT INTO devices (device_id, email, label, first_seen, last_seen)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET last_seen = excluded.last_seen, label = excluded.label`,
    ).run(deviceId, email, deviceLabel ?? '', now, now);
  })();

  const { jwt, expiresAt } = await signJwt(email, deviceId);

  logger.info({ email, deviceId }, 'Auth exchange successful');
  return c.json({ jwt, expiresAt, email });
});
