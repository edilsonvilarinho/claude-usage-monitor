import * as crypto from 'crypto';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const AUTH_URL = 'https://claude.ai/oauth/authorize';
export const OAUTH_REDIRECT_URI = 'https://claude.ai/oauth/callback';
const TOKEN_HOST = 'console.anthropic.com';
const TOKEN_PATH = '/v1/oauth/token';
const SCOPES = 'user:profile user:inference';

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function buildAuthUrl(): { url: string; state: string; codeVerifier: string } {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: OAUTH_REDIRECT_URI,
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  return { url: `${AUTH_URL}?${params.toString()}`, state, codeVerifier };
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<void> {
  const tokens = await exchangeCodeForToken(code, codeVerifier);
  saveCredentials(tokens.access_token, tokens.refresh_token, tokens.expires_in);
}

function exchangeCodeForToken(code: string, codeVerifier: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: OAUTH_REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    });

    const req = https.request({
      hostname: TOKEN_HOST,
      port: 443,
      path: TOKEN_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          if (!parsed['access_token']) {
            reject(new Error(`Token exchange failed: ${data}`));
          } else {
            resolve(parsed as { access_token: string; refresh_token?: string; expires_in?: number });
          }
        } catch {
          reject(new Error(`Failed to parse token response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Token request timed out')));
    req.write(body);
    req.end();
  });
}

function saveCredentials(accessToken: string, refreshToken: string | undefined, expiresIn: number | undefined): void {
  const userProfile = process.env['USERPROFILE'] || process.env['HOME'] || '';
  const claudeDir = path.join(userProfile, '.claude');
  const credFilePath = path.join(claudeDir, '.credentials.json');

  fs.mkdirSync(claudeDir, { recursive: true });

  const credentialsFile = {
    claudeAiOauth: {
      accessToken,
      refreshToken: refreshToken ?? '',
      expiresAt: Date.now() + (expiresIn ?? 3600) * 1000,
    },
  };

  fs.writeFileSync(credFilePath, JSON.stringify(credentialsFile, null, 2), 'utf-8');
}
