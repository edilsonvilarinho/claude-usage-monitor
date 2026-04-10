import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { healthRoute } from './routes/health';
import { authRoute } from './routes/auth';
import { syncRoute } from './routes/sync';

const app = new Hono();

app.route('/health', healthRoute);
app.route('/auth', authRoute);
app.route('/sync', syncRoute);

const port = Number(process.env.PORT ?? 3030);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`server running on http://localhost:${info.port}`);
});
