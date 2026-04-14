import * as https from 'https';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion: string;
  releaseUrl: string;
}

function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [lMaj, lMin, lPatch] = parse(latest);
  const [cMaj, cMin, cPatch] = parse(current);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPatch > cPatch;
}

export function checkForUpdate(currentVersion: string): Promise<UpdateCheckResult> {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const options = {
      hostname: 'api.github.com',
      path: '/repos/edilsonvilarinho/claude-usage-monitor/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': `claude-usage-monitor/${currentVersion}`,
        'Accept': 'application/vnd.github+json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const json = JSON.parse(body) as { tag_name?: string; html_url?: string };
          const latestVersion = json.tag_name ?? '';
          const releaseUrl = 'https://github.com/edilsonvilarinho/claude-usage-monitor/releases';
          const hasUpdate = latestVersion !== '' && isNewer(latestVersion, currentVersion);
          resolve({ hasUpdate, latestVersion: latestVersion.replace(/^v/, ''), releaseUrl });
        } catch {
          resolve({ hasUpdate: false, latestVersion: '', releaseUrl: '' });
        }
      });
    });

    req.on('error', () => {
      clearTimeout(timeout);
      resolve({ hasUpdate: false, latestVersion: '', releaseUrl: '' });
    });

    controller.signal.addEventListener('abort', () => {
      req.destroy();
      resolve({ hasUpdate: false, latestVersion: '', releaseUrl: '' });
    });

    req.end();
  });
}
