import type { Context, Next } from 'hono';

// Fase 2: middleware que valida JWT no header Authorization: Bearer
export async function authGuard(_c: Context, _next: Next): Promise<Response> {
  return new Response(JSON.stringify({ error: 'not_implemented' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });
}
