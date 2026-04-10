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

const app = new Hono();

// CORS
const corsOrigin = process.env.CORS_ORIGIN ?? '*';
app.use('*', cors({ origin: corsOrigin }));

// Logger middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  logger.info(
    { method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - start },
    'request',
  );
});

// Rate limit em todas as rotas exceto /health
app.use('/auth/*', rateLimit);
app.use('/sync/*', rateLimit);

// Auth guard em /sync/*
app.use('/sync/*', authGuard);

// Rotas
app.route('/health', healthRoute);
app.route('/auth', authRoute);
app.route('/sync', syncRoute);

// Error handler genérico
app.onError((err, c) => {
  logger.error({ err }, 'Unhandled error');
  return c.json({ error: 'internal_error' }, 500);
});

// Inicializa DB no boot
getDb();
logger.info('Database initialized');

const port = Number(process.env.PORT ?? 3030);

serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port }, 'Server running');
});
