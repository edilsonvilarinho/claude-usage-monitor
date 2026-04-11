import { SignJWT, jwtVerify } from 'jose';
import { logger } from '../logger';

const JWT_EXPIRY_SECONDS = 24 * 60 * 60; // 24h

let _secret: Uint8Array | null = null;

function secret(): Uint8Array {
  if (_secret) return _secret;
  const raw = process.env.JWT_SECRET;
  if (!raw) {
    logger.warn('JWT_SECRET not set — using random ephemeral secret (dev only)');
    const random = Math.random().toString(36).repeat(4);
    _secret = new TextEncoder().encode(random);
  } else {
    _secret = new TextEncoder().encode(raw);
  }
  return _secret;
}

export interface JwtPayload {
  email: string;
  deviceId: string;
}

export async function signJwt(
  email: string,
  deviceId: string,
): Promise<{ jwt: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAtSec = now + JWT_EXPIRY_SECONDS;

  const jwt = await new SignJWT({ email, deviceId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(expiresAtSec)
    .sign(secret());

  return { jwt, expiresAt: expiresAtSec * 1000 };
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret());
  const email = payload['email'] as string | undefined;
  const deviceId = payload['deviceId'] as string | undefined;

  if (!email || !deviceId) {
    throw new Error('JWT payload missing email or deviceId');
  }

  return { email, deviceId };
}
