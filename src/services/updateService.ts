import * as https from 'https';
import * as fs from 'fs';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion: string;
  releaseUrl: string;
  downloadUrl: string;
  isMajorUpdate: boolean;
}

function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [lMaj, lMin, lPatch] = parse(latest);
  const [cMaj, cMin, cPatch] = parse(current);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPatch > cPatch;
}

function isMajorVersionDiff(latest: string, current: string): boolean {
  const parse = (v: string) => parseInt(v.replace(/^v/, '').split('.')[0] ?? '0', 10);
  return parse(latest) !== parse(current);
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
          const json = JSON.parse(body) as {
            tag_name?: string;
            html_url?: string;
            assets?: Array<{ name: string; browser_download_url: string }>;
          };
          const latestVersion = json.tag_name ?? '';
          const releaseUrl = 'https://github.com/edilsonvilarinho/claude-usage-monitor/releases';
          const hasUpdate = latestVersion !== '' && isNewer(latestVersion, currentVersion);
          const assets = json.assets ?? [];
          const exeAsset = assets.find(a => a.name.endsWith('Setup.exe') || a.name.endsWith('setup.exe'));
          const downloadUrl = hasUpdate ? (exeAsset?.browser_download_url ?? '') : '';
          const isMajorUpdate = hasUpdate && isMajorVersionDiff(latestVersion, currentVersion);
          resolve({ hasUpdate, latestVersion: latestVersion.replace(/^v/, ''), releaseUrl, downloadUrl, isMajorUpdate });
        } catch {
          resolve({ hasUpdate: false, latestVersion: '', releaseUrl: '', downloadUrl: '', isMajorUpdate: false });
        }
      });
    });

    req.on('error', () => {
      clearTimeout(timeout);
      resolve({ hasUpdate: false, latestVersion: '', releaseUrl: '', downloadUrl: '', isMajorUpdate: false });
    });

    controller.signal.addEventListener('abort', () => {
      req.destroy();
      resolve({ hasUpdate: false, latestVersion: '', releaseUrl: '', downloadUrl: '', isMajorUpdate: false });
    });

    req.end();
  });
}

function httpsGet(url: string): Promise<import('http').IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'claude-usage-monitor' } }, (res) => {
      resolve(res);
    });
    req.on('error', reject);
  });
}

export async function downloadUpdate(
  url: string,
  destPath: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  // Follow up to 5 redirects
  let currentUrl = url;
  let res = await httpsGet(currentUrl);
  let redirectCount = 0;
  while ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307 || res.statusCode === 308) && redirectCount < 5) {
    const location = res.headers['location'];
    if (!location) break;
    res.resume(); // consume and discard response body
    currentUrl = location;
    res = await httpsGet(currentUrl);
    redirectCount++;
  }

  const totalStr = res.headers['content-length'];
  const total = totalStr ? parseInt(totalStr, 10) : 0;
  let received = 0;

  await new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    res.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (total > 0) onProgress(Math.round((received / total) * 100));
      file.write(chunk);
    });
    res.on('end', () => {
      file.end(() => resolve());
    });
    res.on('error', (err) => {
      file.destroy();
      reject(err);
    });
    file.on('error', reject);
  });
}
