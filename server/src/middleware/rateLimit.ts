import type { Context, Next } from 'hono';

// Fase 2: 60 req/min por usuário (sliding window em memória ou Redis)
export async function rateLimit(_c: Context, _next: Next): Promise<Response> {
  return new Response(JSON.stringify({ error: 'not_implemented' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });
}
