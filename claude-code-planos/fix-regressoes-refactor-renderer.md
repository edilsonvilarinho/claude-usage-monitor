# Fix: Corrigir regressões da refatoração renderer

**Branch:** `refactor-renderer-clean-architecture-minimax`  
**Data início:** 2026-04-20  
**Status:** ✅ Concluído (2026-04-20)

---

## Contexto

O minimax refatorou o renderer de um monolito (3038L `app.ts`) para arquitetura modular limpa em 16 fases. A refatoração foi concluída, mas introduziu 4 bugs que quebram partes da UI:
- Abas do modal de configurações não funcionam
- Botões de cloud sync falham ao clicar
- Gráficos gauge mostram valores errados (quase 0%)
- `loadSettings()` nunca roda (crash silencioso em `bootstrap()`)

---

## Bugs confirmados

### Bug 1 — `setupTabSwitcher()` quebrado ❌
**Arquivo:** `src/presentation/components/settings/SettingsLayout.ts` + `src/renderer/AppBootstrap.ts:130`

3 sub-problemas combinados:
- `document.queryAll()` (linhas 7 e 12) **não existe** no DOM → deve ser `querySelectorAll()`
- Selector `.settings-tab-btn` não bate com o HTML → botões têm `class="tab-btn"`
- `AppBootstrap.ts:130` chama `setupTabSwitcher()` **sem argumentos**, função exige `(wrapperId, tabs)`

**Impacto crítico:** TypeError lançado em `setupTabSwitcher()` causa crash silencioso do `bootstrap()` (chamado com `void`), fazendo `await loadSettings()` (linha 132) **nunca executar**. Resultado em cascata: sem tema, sem traduções, sem settings populados, sem cloud sync carregado.

### Bug 2 — `CloudSyncPanel.applyCloudSyncStatus()` não existe ❌
**Arquivo:** `src/presentation/components/sync/CloudSyncPanel.ts`

Chamado em 6 lugares no AppBootstrap.ts (linhas 148, 167, 183, 197, 207, 777), mas classe só tem `renderEnabled()`, `renderDisabled()` e `updateHeaderIcon()`.

### Bug 3 — Gauge charts com escala errada ❌
**Arquivo:** `src/renderer/AppBootstrap.ts` função `updateUI()` (linhas 814–819)

```
const sessionPct = data.five_hour.utilization / 100;  // → 0-1 range
sessionGauge.update(sessionPct);   // gauge espera 0-100!
```
`GaugeChart.update()` clipa em [0,100] → 0.75 vira 0.75% (quase vazio). `colorForPct()` usa thresholds 60/80 em escala 0-100 → sempre retorna verde.

### Bug 4 — `btn-refresh` ausente do HTML (minor) ⚠️
**Arquivo:** `src/renderer/partials/shell/header.html`

`AppBootstrap.ts:257` registra listener em `#btn-refresh`, mas o botão não existe no header. O `?.` silencia o erro mas usuário perde funcionalidade.

---

## Plano de execução

### Fase 1 — Corrigir `setupTabSwitcher()` [ ] 
**Arquivo:** `src/presentation/components/settings/SettingsLayout.ts`

Reescrever sem args, usando padrão `data-tab` do HTML:
```typescript
export function setupTabSwitcher(): void {
  const buttons = document.querySelectorAll<HTMLElement>('.settings-tabs .tab-btn');
  const panes = document.querySelectorAll<HTMLElement>('.tab-pane');
  panes.forEach((pane, i) => pane.classList.toggle('hidden', i !== 0));
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = (btn as HTMLElement).dataset.tab;
      if (!tabId) return;
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      panes.forEach(pane => pane.classList.toggle('hidden', pane.id !== tabId));
    });
  });
}
```
Remover interface `Tab` e parâmetros `wrapperId`/`tabs[]`.

### Fase 2 — Adicionar `applyCloudSyncStatus()` [ ]
**Arquivo:** `src/presentation/components/sync/CloudSyncPanel.ts`

```typescript
applyCloudSyncStatus(status: SyncStatus): void {
  this.updateHeaderIcon({ enabled: status.enabled });
  if (status.enabled) {
    this.renderEnabled({ email: status.email, lastSyncAt: status.lastSyncAt, pendingOps: status.pendingOps });
  } else {
    this.renderDisabled();
  }
}
```

### Fase 3 — Corrigir escala dos gauges [ ]
**Arquivo:** `src/renderer/AppBootstrap.ts` linhas ~817–819

```typescript
// ANTES: sessionGauge.update(sessionPct)
// DEPOIS:
sessionGauge.update(sessionPct * 100);
weeklyGauge.update(weeklyPct * 100);
trayIcon.render(sessionPct * 100, weeklyPct * 100);
```

### Fase 4 — Verificar btn-refresh [ ]
Decidir se o botão de refresh foi removido intencionalmente ou precisa ser adicionado de volta ao `header.html`.

### Fase 5 — Build e smoke test [ ]
```bash
npm run build
```
Verificar: gauges corretos, abas settings funcionam, tema/traduções aplicados, sync sem erro no console.

---

## Progresso

| Fase | Status | Notas |
|------|--------|-------|
| 1 — setupTabSwitcher | ✅ | Reescrito sem args, usando `.tab-btn` + `data-tab` |
| 2 — applyCloudSyncStatus | ✅ | Método adicionado ao CloudSyncPanel |
| 3 — escala gauges | ✅ | `sessionPct * 100` e `weeklyPct * 100` |
| 4 — btn-refresh | ✅ | Botão removido intencionalmente; listener com `?.` é dead code inofensivo |
| 5 — build + smoke test | ✅ | `npm run build` → clean exit |

---

## Problemas encontrados no decorrer

*(será preenchido durante a execução)*
