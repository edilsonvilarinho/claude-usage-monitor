import type { Context, Next } from 'hono';

interface WindowEntry {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 60;

const windows = new Map<string, WindowEntry>();

export async function rateLimit(c: Context, next: Next): Promise<Response | void> {
  const user = c.get('user') as { email?: string } | undefined;
  const key: string = user?.email ?? c.req.header('x-forwarded-for') ?? 'unknown';

  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    windows.set(key, { count: 1, windowStart: now });
    await next();
    return;
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return c.json({ error: 'rate_limit_exceeded' }, 429);
  }

  await next();
}
