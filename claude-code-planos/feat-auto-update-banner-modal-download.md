# feat: auto-update — banner persistente, modal major update, auto-download Windows

**Status:** ✅ Implementado
**Data:** 2026-04-19
**Arquivos afetados:** 7

---

## Objetivo

1. Banner de aviso de nova versão no popup principal, persistente até o usuário atualizar
2. Verificação periódica a cada 30 minutos em background
3. Modal de aviso quando a diferença de versão for major (ex: v1.x → v2.x)
4. Auto-download do `Setup.exe` para Windows com progresso

---

## Dependências entre arquivos

```
updateService.ts  →  main.ts  →  preload.ts  →  index.html + app.ts
```

---

## Passo 1 — `src/services/updateService.ts`

**Expandir `UpdateCheckResult`:**
```typescript
export interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion: string;
  releaseUrl: string;
  downloadUrl: string;      // URL do asset Setup.exe ('' se não disponível)
  isMajorUpdate: boolean;   // true quando major version muda
}
```

**Adicionar `isMajorVersionDiff(latest, current)`:**
- Parseia major de cada versão via `split('.')[0]`
- Retorna `true` quando diferem

**Expandir o JSON parse** para incluir `assets?: Array<{ name: string; browser_download_url: string }>`.
Filtrar o asset terminando em `Setup.exe`:
```typescript
const exeAsset = assets.find(a => a.name.endsWith('Setup.exe') || a.name.endsWith('setup.exe'));
const downloadUrl = hasUpdate ? (exeAsset?.browser_download_url ?? '') : '';
```

**Adicionar `downloadUpdate(url, destPath, onProgress)`:**
- Usa `https` nativo (já importado)
- Segue redirects HTTP 301–308 manualmente (GitHub → CDN) via loop de até 5 redirects
- Calcula progresso via `content-length` header
- Salva em `destPath` usando `fs.createWriteStream`

---

## Passo 2 — `src/main.ts` (6 mudanças)

**2a.** Importar `downloadUpdate`:
```typescript
import { checkForUpdate, downloadUpdate } from './services/updateService';
```

**2b.** Adicionar estado `pendingUpdate` (após `credentialPath`):
```typescript
let pendingUpdate: {
  version: string;
  url: string;
  downloadUrl: string;
  isMajor: boolean;
} | null = null;
```

**2c.** Em `runUpdateCheck()`, popular `pendingUpdate` e enviar IPC com `isMajor` + `downloadUrl`:
```typescript
if (result.hasUpdate) {
  pendingUpdate = { version, url, downloadUrl, isMajor };
  showUpdateAvailableToast(...);
  popup?.webContents.send('update-available', { version, url, downloadUrl, isMajor });
}
```

**2d.** Em `togglePopup()`, re-enviar `pendingUpdate` quando popup reabre:
```typescript
if (pendingUpdate) {
  popup.webContents.send('update-available', { ...pendingUpdate });
}
```
Posição: após bloco `credentialExpiredSent`, antes de `next-poll-at`.

**2e.** Novos IPC handlers em `registerIpcHandlers()`:
```typescript
ipcMain.handle('download-update', async () => {
  if (!pendingUpdate?.downloadUrl) {
    if (pendingUpdate?.url) await shell.openExternal(pendingUpdate.url);
    return;
  }
  const destPath = path.join(app.getPath('temp'), 'claude-usage-monitor-setup.exe');
  await downloadUpdate(pendingUpdate.downloadUrl, destPath, (pct) => {
    popup?.webContents.send('update-download-progress', pct);
  });
  await shell.openPath(destPath);
});

ipcMain.on('dismiss-update', () => { pendingUpdate = null; });
```

**2f.** `setInterval` de 30min após o `setTimeout` de 5s:
```typescript
setInterval(() => { void runUpdateCheck(true); }, 30 * 60 * 1000);
```
> `forceCheck = true` — o intervalo periódico não respeita o cooldown de 24h.

---

## Passo 3 — `src/preload.ts`

Atualizar `onUpdateAvailable` com novo tipo:
```typescript
onUpdateAvailable: (cb: (info: { version: string; url: string; downloadUrl: string; isMajor: boolean }) => void): void
```

Adicionar:
```typescript
downloadUpdate: (): Promise<void> => ipcRenderer.invoke('download-update'),
dismissUpdate: (): void => { ipcRenderer.send('dismiss-update'); },
onUpdateDownloadProgress: (cb: (pct: number) => void): void => {
  ipcRenderer.on('update-download-progress', (_event, pct: number) => cb(pct));
},
```

---

## Passo 4 — `src/renderer/styles.css`

Adicionar ao final:

```css
/* ── Update major modal ────────────────────────────────────────────── */
.update-major-modal-box { width: 280px; text-align: center; }
.update-major-modal-icon { font-size: 28px; color: var(--accent-blue); margin-bottom: 6px; }
.update-major-modal-title { font-size: 13px; font-weight: 600; ... }
.update-major-modal-desc { font-size: 11px; color: var(--text-secondary); ... }
.update-major-progress-track { height: 6px; background: var(--surface); border-radius: 3px; }
.update-major-progress-fill { height: 100%; background: var(--accent-blue); transition: width 0.3s ease; }
.update-major-progress-label { font-size: 10px; color: var(--text-secondary); }
```

---

## Passo 5 — `src/renderer/index.html`

Adicionar antes de `<script src="app.js">`:

```html
<div id="update-major-modal" class="modal-overlay hidden">
  <div class="modal-box update-major-modal-box">
    <div class="update-major-modal-icon">⬆</div>
    <h3 class="update-major-modal-title">Nova versão disponível</h3>
    <p class="update-major-modal-desc" id="update-major-modal-desc">...</p>
    <div id="update-major-progress-wrap" style="display:none">
      <div class="update-major-progress-track">
        <div class="update-major-progress-fill" id="update-major-progress-fill"></div>
      </div>
      <span class="update-major-progress-label" id="update-major-progress-label">0%</span>
    </div>
    <div class="modal-actions">
      <button id="update-major-later-btn">Mais tarde</button>
      <button id="update-major-download-btn">Baixar</button>
    </div>
  </div>
</div>
```

---

## Passo 6 — `src/renderer/app.ts` (4 mudanças)

**6a.** Tipo `Window['claudeUsage']`:
```typescript
onUpdateAvailable: (cb: (info: { version: string; url: string; downloadUrl: string; isMajor: boolean }) => void) => void;
downloadUpdate: () => Promise<void>;
dismissUpdate: () => void;
onUpdateDownloadProgress: (cb: (pct: number) => void) => void;
```

**6b.** Handler `onUpdateAvailable` — exibe modal quando `isMajor === true`:
```typescript
window.claudeUsage.onUpdateAvailable(({ version, url, downloadUrl, isMajor }) => {
  // sempre mostra banner
  banner.dataset.downloadUrl = downloadUrl;
  // se major → abre modal também
  if (isMajor) {
    desc.textContent = `A versão v${version} inclui mudanças importantes...`;
    modal.classList.remove('hidden');
  }
});
```

**6c.** Handler `btn-update-download` — usa `downloadUpdate()` se `downloadUrl` disponível:
```typescript
const downloadUrl = banner?.dataset.downloadUrl;
if (downloadUrl) void window.claudeUsage.downloadUpdate();
else window.claudeUsage.openReleaseUrl(releaseUrl);
```

**6d.** Handlers do modal e progresso:
- `#update-major-later-btn` → `dismissUpdate()` + fecha modal
- `#update-major-download-btn` → `downloadUpdate()` com barra de progresso
- `onUpdateDownloadProgress` → atualiza fill e label

---

## Passo 7 — `BUSINESS_RULES.md`

Adicionada seção **11. Módulo de Verificação de Atualizações** documentando:
- Fonte de dados (GitHub Releases API)
- Frequência de verificação (tabela startup / periódico / manual)
- Estado `pendingUpdate` em memória
- Detecção de major update
- Fluxo de auto-download com redirects
- Tabela UX por tipo de update

---

## Regras de negócio adicionadas

| Regra | Valor |
|-------|-------|
| Intervalo periódico de verificação | 30 minutos |
| Cooldown de startup | 24 horas (não se aplica ao intervalo) |
| Limiar de major update | `major(latest) !== major(current)` |
| Destino do download (Windows) | `%TEMP%\claude-usage-monitor-setup.exe` |
| Máx redirects seguidos | 5 |
| Fallback sem downloadUrl | `shell.openExternal(releaseUrl)` |

---

## Viabilidade do auto-download

✅ **Viável para Windows** — GitHub Releases API retorna `assets[]` com `browser_download_url` direto para o `.exe`.
O único cuidado implementado foi seguir redirects HTTP 301–308 manualmente, pois o Node `https` nativo não os segue automaticamente e o GitHub redireciona assets para CDN.
