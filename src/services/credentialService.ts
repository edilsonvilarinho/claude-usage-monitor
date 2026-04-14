import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { CredentialsFile } from '../models/usageData';

const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 minutes
const OAUTH_REFRESH_URL = 'console.anthropic.com';
const OAUTH_REFRESH_PATH = '/v1/oauth/token';

function findCredentialPaths(): string[] {
  const candidates: string[] = [];

  // Primary: native path (~/.claude/.credentials.json)
  const homePath = path.join(process.env['USERPROFILE'] || process.env['HOME'] || '', '.claude', '.credentials.json');
  if (fs.existsSync(homePath)) {
    candidates.push(homePath);
  }

  // Fallback: WSL paths (Windows only)
  if (process.platform === 'win32') {
    const wslBase = '\\\\wsl.localhost';
    if (fs.existsSync(wslBase)) {
      try {
        const distros = fs.readdirSync(wslBase);
        for (const distro of distros) {
          const homeBase = path.join(wslBase, distro, 'home');
          if (!fs.existsSync(homeBase)) continue;
          try {
            const users = fs.readdirSync(homeBase);
            for (const user of users) {
              const wslCredPath = path.join(homeBase, user, '.claude', '.credentials.json');
              if (fs.existsSync(wslCredPath)) {
                candidates.push(wslCredPath);
              }
            }
          } catch {
            // skip inaccessible directories
          }
        }
      } catch {
        // WSL not available or inaccessible
      }
    }
  }

  return candidates;
}

function pickMostRecentFile(paths: string[]): string | null {
  if (paths.length === 0) return null;
  if (paths.length === 1) return paths[0];

  let best = paths[0];
  let bestMtime = fs.statSync(best).mtimeMs;

  for (let i = 1; i < paths.length; i++) {
    const mtime = fs.statSync(paths[i]).mtimeMs;
    if (mtime > bestMtime) {
      bestMtime = mtime;
      best = paths[i];
    }
  }

  return best;
}

function readCredentials(filePath: string): CredentialsFile {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as CredentialsFile;
}

function writeCredentials(filePath: string, creds: CredentialsFile): void {
  fs.writeFileSync(filePath, JSON.stringify(creds, null, 2), 'utf-8');
}

function httpsPost(hostname: string, path: string, body: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname,
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse refresh response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error('Token refresh request timed out'));
    });

    req.write(payload);
    req.end();
  });
}

async function refreshToken(filePath: string, creds: CredentialsFile): Promise<string> {
  const response = await httpsPost(OAUTH_REFRESH_URL, OAUTH_REFRESH_PATH, {
    grant_type: 'refresh_token',
    refresh_token: creds.claudeAiOauth.refreshToken,
  }) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!response.access_token) {
    throw new Error('Token refresh failed: no access_token in response');
  }

  creds.claudeAiOauth.accessToken = response.access_token;
  if (response.refresh_token) {
    creds.claudeAiOauth.refreshToken = response.refresh_token;
  }
  if (response.expires_in) {
    creds.claudeAiOauth.expiresAt = Date.now() + response.expires_in * 1000;
  }

  writeCredentials(filePath, creds);
  return creds.claudeAiOauth.accessToken;
}

export async function getAccessToken(): Promise<string> {
  const paths = findCredentialPaths();
  const filePath = pickMostRecentFile(paths);

  if (!filePath) {
    throw new Error(
      'Claude credentials not found. Make sure you are logged in to Claude Code.\n' +
      'Expected location: ' + path.join(process.env['USERPROFILE'] || process.env['HOME'] || '~', '.claude', '.credentials.json')
    );
  }

  const creds = readCredentials(filePath);

  if (!creds.claudeAiOauth?.accessToken) {
    throw new Error('Invalid credentials file: missing accessToken');
  }

  const expiresAt = creds.claudeAiOauth.expiresAt ?? 0;
  const needsRefresh = expiresAt - Date.now() < TOKEN_REFRESH_MARGIN_MS;

  if (needsRefresh && creds.claudeAiOauth.refreshToken) {
    try {
      return await refreshToken(filePath, creds);
    } catch (err) {
      console.warn('[CredentialService] Token refresh failed, using existing token:', err);
      // Notify renderer that credentials expired (if in renderer process)
      try {
        const { BrowserWindow } = await import('electron');
        const wins = BrowserWindow.getAllWindows();
        wins.forEach(win => {
          win.webContents.send('credentials-expired');
        });
      } catch {
        // Silent fail in tests or main process
      }
      return creds.claudeAiOauth.accessToken;
    }
  }

  return creds.claudeAiOauth.accessToken;
}
