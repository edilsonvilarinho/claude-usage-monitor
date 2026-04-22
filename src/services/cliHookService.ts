import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { getAccessToken } from './credentialService';

const CLI_SERVER_URL = 'http://104.131.23.0:3030';
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const HOOK_SCRIPT = path.join(CLAUDE_DIR, 'hooks', 'claude-usage-capture.js');
const CLAUDE_SETTINGS = path.join(CLAUDE_DIR, 'settings.json');
const TOKEN_FILE = path.join(CLAUDE_DIR, 'claude-usage-token.json');
const HOOK_COMMAND = `node ${HOOK_SCRIPT.replace(/\\/g, '/')}`;

const FIVE_MIN = 5 * 60 * 1000;
const REFRESH_INTERVAL = 60 * 60 * 1000; // 1h

const HOOK_SCRIPT_CONTENT = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const TOKEN_FILE = path.join(os.homedir(), '.claude', 'claude-usage-token.json');
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const hook = JSON.parse(raw);
    const usage = hook?.tool_response?.usage ?? hook?.usage;
    if (!usage) process.exit(0);
    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
    const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
    if (inputTokens === 0 && outputTokens === 0) process.exit(0);
    let tokenData;
    try { tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); } catch { process.exit(0); }
    const { jwt, deviceId, serverUrl, expiresAt } = tokenData;
    if (!jwt || !deviceId || !serverUrl) process.exit(0);
    if (expiresAt && expiresAt < Date.now()) process.exit(0);
    const event = { ts: Date.now(), sessionId: hook.session_id ?? 'unknown', toolName: hook.tool_name ?? 'unknown', inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens };
    const payload = JSON.stringify({ deviceId, daily: [], sessionWindows: [], timeSeries: [], usageSnapshots: [], cliEvents: [event] });
    if (typeof fetch === 'function') {
      fetch(\`\${serverUrl}/sync/push\`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${jwt}\` }, body: payload }).catch(() => {});
    } else {
      const url = new URL(\`\${serverUrl}/sync/push\`);
      const mod = url.protocol === 'https:' ? require('https') : require('http');
      const req = mod.request({ hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${jwt}\`, 'Content-Length': Buffer.byteLength(payload) } });
      req.on('error', () => {}); req.write(payload); req.end();
    }
  } catch {}
  process.exit(0);
});
`;

function installHookScript(): void {
  try {
    fs.mkdirSync(path.join(CLAUDE_DIR, 'hooks'), { recursive: true });
    fs.writeFileSync(HOOK_SCRIPT, HOOK_SCRIPT_CONTENT, { mode: 0o755 });

    let settings: Record<string, unknown> = {};
    try { settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS, 'utf8')); } catch { /* novo */ }

    const hooks = (settings['hooks'] ?? {}) as Record<string, unknown>;
    const postToolUse = Array.isArray(hooks['PostToolUse']) ? (hooks['PostToolUse'] as unknown[]) : [];

    const alreadyRegistered = postToolUse.some((e) => JSON.stringify(e).includes(HOOK_COMMAND));
    if (!alreadyRegistered) {
      postToolUse.push({ matcher: '*', hooks: [{ type: 'command', command: HOOK_COMMAND }] });
      hooks['PostToolUse'] = postToolUse;
      settings['hooks'] = hooks;
      fs.writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2), 'utf8');
    }
  } catch {
    // silencioso
  }
}

async function exchangeJwt(deviceId: string): Promise<{ jwt: string; expiresAt: number } | null> {
  try {
    const accessToken = await getAccessToken();
    const resp = await fetch(`${CLI_SERVER_URL}/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, deviceId, deviceLabel: `${os.hostname()}-cli` }),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { jwt: string; expiresAt: number };
    return data;
  } catch {
    return null;
  }
}

function readTokenFile(): { jwt: string; deviceId: string; expiresAt: number } | null {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeTokenFile(jwt: string, deviceId: string, expiresAt: number): void {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ jwt, deviceId, serverUrl: CLI_SERVER_URL, expiresAt }), { mode: 0o600 });
  } catch { /* silencioso */ }
}

async function refreshIfNeeded(): Promise<void> {
  const existing = readTokenFile();
  const deviceId = existing?.deviceId ?? crypto.randomUUID();

  if (existing?.jwt && existing.expiresAt > Date.now() + FIVE_MIN) return;

  const result = await exchangeJwt(deviceId);
  if (result) {
    writeTokenFile(result.jwt, deviceId, result.expiresAt);
  }
}

class CliHookService {
  private timer: ReturnType<typeof setInterval> | null = null;

  async init(): Promise<void> {
    installHookScript();
    await refreshIfNeeded();
    this.timer = setInterval(() => { void refreshIfNeeded(); }, REFRESH_INTERVAL);
  }

  destroy(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}

export const cliHookService = new CliHookService();
