import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { healthRoute } from './routes/health';
import { authRoute } from './routes/auth';
import { syncRoute } from './routes/sync';
import { authGuard } from './middleware/authGuard';
import { rateLimit } from './middleware/rateLimit';
import { getDb } from './db/client';
import { logger } from './logger';
import { setupWebSocket } from './routes/ws';

const app = new Hono();

const corsOrigin = process.env.CORS_ORIGIN ?? '*';
app.use('*', cors({ origin: corsOrigin }));

app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  logger.info(
    { method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - start },
    'request',
  );
});

app.use('/auth/*', rateLimit);
app.use('/sync/*', rateLimit);
app.use('/sync/*', authGuard);

app.route('/health', healthRoute);
app.route('/auth', authRoute);
app.route('/sync', syncRoute);

app.onError((err, c) => {
  logger.error({ err }, 'Unhandled error');
  return c.json({ error: 'internal_error' }, 500);
});

getDb();
logger.info('Database initialized');

const port = Number(process.env.PORT ?? 3030);

const server = serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  logger.info({ port: info.port }, 'Server running');
});

setupWebSocket(server as any);
