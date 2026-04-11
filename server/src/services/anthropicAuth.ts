import { logger } from '../logger';

interface CacheEntry {
  email: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

export async function validateAnthropicToken(accessToken: string): Promise<{ email: string }> {
  const now = Date.now();
  const cached = cache.get(accessToken);
  if (cached && cached.expiresAt > now) {
    return { email: cached.email };
  }

  const res = await fetch('https://api.anthropic.com/api/oauth/profile', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20',
    },
  });

  if (!res.ok) {
    logger.warn({ status: res.status }, 'Anthropic token validation failed');
    throw new Error(`Invalid token: ${res.status}`);
  }

  const body = (await res.json()) as {
    account?: { email_address?: string; email?: string };
    email_address?: string;
  };

  const email =
    body?.account?.email_address ??
    body?.account?.email ??
    body?.email_address;

  if (!email) {
    logger.warn({ body }, 'Could not extract email from Anthropic profile');
    throw new Error('Could not extract email from Anthropic profile response');
  }

  cache.set(accessToken, { email, expiresAt: now + CACHE_TTL_MS });

  return { email };
}
