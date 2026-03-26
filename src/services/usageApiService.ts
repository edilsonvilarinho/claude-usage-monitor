import * as https from 'https';
import { execSync } from 'child_process';
import { getAccessToken } from './credentialService';
import { UsageData } from '../models/usageData';

const API_HOST = 'api.anthropic.com';
const API_PATH = '/api/oauth/usage';
const MAX_RETRIES = 5;

let cachedClaudeVersion: string | null = null;

function getClaudeVersion(): string {
  if (cachedClaudeVersion) return cachedClaudeVersion;
  try {
    const output = execSync('claude --version', { encoding: 'utf-8', timeout: 5000 }).trim();
    // Parse version: last token matching digits.digits pattern
    const match = output.match(/(\d+\.\d+[\.\d]*)/);
    cachedClaudeVersion = match ? match[1] : '2.0.0';
  } catch {
    cachedClaudeVersion = '2.0.0';
  }
  return cachedClaudeVersion;
}

function httpsGet(hostname: string, path: string, headers: Record<string, string>): Promise<{ statusCode: number; body: string; retryAfter?: number }> {
  return new Promise((resolve, reject) => {
    const options = { hostname, port: 443, path, method: 'GET', headers };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const retryAfterRaw = res.headers['retry-after'];
        const retryAfter = retryAfterRaw ? parseInt(String(retryAfterRaw), 10) : undefined;
        resolve({ statusCode: res.statusCode ?? 0, body: data, retryAfter });
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Usage API request timed out')));
    req.end();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchUsageData(forceTokenRefresh = false): Promise<UsageData> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const token = await getAccessToken();
    const version = getClaudeVersion();

    try {
      const { statusCode, body, retryAfter } = await httpsGet(API_HOST, API_PATH, {
        'Authorization': `Bearer ${token}`,
        'User-Agent': `claude-code/${version}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'Accept': 'application/json',
      });

      if (statusCode === 200) {
        const data = JSON.parse(body) as UsageData;
        if (!data.five_hour || !data.seven_day) {
          throw new Error(`Unexpected API response shape: ${body.slice(0, 200)}`);
        }
        return data;
      }

      if (statusCode === 401) {
        // Force a credential refresh on the next attempt
        cachedClaudeVersion = null;
        if (attempt === 0) {
          // Invalidate cached token and retry once
          await sleep(500);
          continue;
        }
        throw new Error(`Authentication failed (401): ${body}`);
      }

      if (statusCode === 429) {
        // Do not retry — let the polling service handle rescheduling
        // Pass retryAfter (seconds) if the API provided it
        const waitSec = retryAfter && !isNaN(retryAfter) ? retryAfter : undefined;
        console.warn(`[UsageAPI] Rate limited (429)${waitSec ? ` — retry after ${waitSec}s` : ''}`);
        throw Object.assign(new Error(`Rate limited (429)`), { isRateLimit: true, retryAfterMs: waitSec ? waitSec * 1000 : undefined });
      }

      if (statusCode >= 500) {
        // Retry with exponential backoff for transient server errors
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 16000);
        lastError = new Error(`API returned ${statusCode}: ${body.slice(0, 100)}`);
        console.warn(`[UsageAPI] Attempt ${attempt + 1} failed (${statusCode}), retrying in ${backoffMs}ms`);
        await sleep(backoffMs);
        continue;
      }

      throw new Error(`Unexpected status ${statusCode}: ${body.slice(0, 200)}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Authentication failed')) {
        throw err;
      }
      if ((err as { isRateLimit?: boolean }).isRateLimit) {
        throw err; // never retry rate limit errors
      }
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES - 1) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 16000);
        await sleep(backoffMs);
      }
    }
  }

  throw lastError ?? new Error('Failed to fetch usage data after max retries');
}
