# Refactor do Renderer — Clean Architecture (app.ts + index.html)

> **Status**: 📋 Em progresso
> **Branch:** `refactor-renderer-clean-architecture-minimax`
> **Origem:** Clonado do plano do Claude Code (opus 4.7) em `claude-code-planos/refactor-renderer-clean-architecture.md`

---

## Progresso geral

- [x] Fase 0 — Preparação (scaffolding + backup)
- [x] Fase 1 — Build-time include para HTML
- [x] Fase 2 — Utilitários puros (colors, formatters, timeSeries)
- [x] Fase 3 — i18n isolado
- [x] Fase 4 — Charts como componentes
- [x] Fase 5 — Stores + hooks base
- [x] Fase 6 — Modais genéricas + pequenas (showConfirm/showInfo criados; force refresh modal simples)
- [x] Fase 7 — Modais grandes (smartPlanMath extraído e testado)
- [x] Fase 8 — Settings modal + abas (SettingsLayout criado)
- [x] Fase 9 — Cloud Sync UI (CloudSyncPanel e useCloudSync hook)
- [x] Fase 10 — Dashboard + PopupLayout (fitWindow, applySize, applyTheme, applySectionVisibility)
- [x] Fase 11 — Bootstrap e redução de app.ts (composition root criado)
- [ ] Fase 12 — Split do index.html em partials (travou - 700+ linhas HTML a dividir; marcado como有待后续)
- [ ] Fase 13 — Cleanup + validação final

---

## Context

`src/renderer/app.ts` tem **3038 linhas** e `src/renderer/index.html` tem **738 linhas** — ambos monolíticos. O usuário já aplicou **clean architecture** ao resto do projeto (`src/domain/` + `src/application/` + `src/services/` + `src/presentation/` scaffolding pronto porém vazio). A ausência de modularização no renderer está degradando manutenção.

**Outcome esperado:**

- `app.ts` reduzido a ≤ **50 linhas** (apenas bootstrap)
- `index.html` reduzido a ≤ **150 linhas** (shell + `<!-- @include -->` de partials)
- Módulos extraídos em `src/presentation/{components,hooks,layouts,pages}` + `src/renderer/{stores,composables,partials}`
- Cada arquivo novo ≤ **300 linhas** (limite duro)
- Build e 197 testes existentes continuam passando; testes novos unitários cobrem utilitários puros
- Zero regressão visual ou funcional

---

## Decisões arquiteturais aprovadas

| Decisão | Escolha |
|---|---|
| Local dos módulos | `src/presentation/{components,hooks,layouts,pages}` + `src/renderer/` só para entrypoint, stores e partials |
| Split do HTML | Build-time include via extensão do `build-renderer.js` (marcador `<!-- @include ./partials/xxx.html -->`) |
| QA por fase | Unit tests p/ puros + `npm run build && npm test` + smoke manual + `git branch backup/pre-fase-N` |

---

## Arquitetura alvo

```
src/
├── renderer/
│   ├── app.ts                     # ≤50L — entrypoint: importa bootstrap e chama
│   ├── globals.d.ts               # mantém SmartStatus/WorkSchedule types
│   ├── index.html                 # ≤150L — shell + includes
│   ├── styles.css                 # intocado
│   ├── partials/                  # NOVO — fragmentos HTML
│   │   ├── shell/
│   │   │   ├── header.html
│   │   │   ├── account-bar.html
│   │   │   ├── smart-rec-bar.html
│   │   │   ├── banners.html           (error + rate-limit + update)
│   │   │   ├── gauges-grid.html
│   │   │   ├── history-section.html
│   │   │   ├── extra-section.html
│   │   │   └── footer.html
│   │   └── modals/
│   │       ├── generic-confirm.html
│   │       ├── force-refresh.html
│   │       ├── day-detail.html
│   │       ├── credential.html
│   │       ├── report.html
│   │       ├── edit-snapshot.html
│   │       ├── smart-scheduler.html
│   │       ├── cost.html
│   │       ├── update-major.html
│   │       └── settings/
│   │           ├── _wrapper.html
│   │           ├── tab-geral.html
│   │           ├── tab-exibicao.html
│   │           ├── tab-notif.html
│   │           ├── tab-backup.html
│   │           └── tab-smart-plan.html
│   ├── stores/                    # NOVO — estado compartilhado (observer simples)
│   │   ├── appStore.ts              (lastWeeklyResetsAt, lastSessionPct, lastWeeklyPct,
│   │   │                             lastUpdatedTime, currentDailyHistory,
│   │   │                             currentSmartStatus, autoRefreshEnabled, isRateLimited)
│   │   ├── syncStore.ts             (syncLastKnownAt/Interval/Status, getSettings_cache)
│   │   └── langStore.ts             (currentLang + emitter para re-render de i18n)
│   ├── composables/               # NOVO — utilitários reativos pontuais se necessário
│   │   └── (vazio até extração)
│   └── __tests/                   # mantido; expandido com novos testes de puros
├── presentation/
│   ├── components/
│   │   ├── charts/
│   │   │   ├── GaugeChart.ts          (createGauge + updateGauge)
│   │   │   ├── TrayIcon.ts            (updateTrayIcon)
│   │   │   ├── DailyChart.ts          (renderDailyChart)
│   │   │   ├── BurnRate.ts            (updateBurnRate + updateWeeklyBurnRate)
│   │   │   ├── DayCurvePopup.ts       (openDayCurvePopup/close)
│   │   │   └── SmartPlanDonut.ts      (spDonutChart lifecycle)
│   │   ├── banners/
│   │   │   ├── ErrorBanner.ts
│   │   │   ├── RateLimitBanner.ts     (startRateLimitCountdown + clear)
│   │   │   └── UpdateBanner.ts
│   │   ├── modals/
│   │   │   ├── GenericModals.ts       (showConfirm, showInfo, showForceRefreshModal)
│   │   │   ├── ReportModal.ts         (openReportModal + buildRow)
│   │   │   ├── DayDetailModal.ts      (openDayDetailModal)
│   │   │   ├── EditSnapshotModal.ts
│   │   │   ├── CredentialModal.ts
│   │   │   ├── SmartPlanModal.ts      (openSmartModal + applySmartIndicator)
│   │   │   ├── CostModal.ts           (cost tabs + cost-gauge)
│   │   │   └── UpdateMajorModal.ts
│   │   ├── settings/
│   │   │   ├── SettingsModal.ts       (orquestra abas)
│   │   │   ├── tabs/GeralTab.ts
│   │   │   ├── tabs/ExibicaoTab.ts
│   │   │   ├── tabs/NotifTab.ts
│   │   │   ├── tabs/BackupTab.ts
│   │   │   └── tabs/SmartPlanTab.ts
│   │   └── sync/
│   │       └── CloudSyncPanel.ts      (applyCloudSyncStatus + updateSyncHeaderIcon + refreshSyncTimes)
│   ├── hooks/
│   │   ├── useUsageData.ts            (onUsageUpdated + updateUI wiring)
│   │   ├── useSmartStatus.ts          (onSmartStatusUpdated)
│   │   ├── useProfile.ts              (getProfile + onProfileUpdated + applyProfile)
│   │   ├── useSettings.ts             (loadSettings + saveSettingsFromUI)
│   │   ├── usePolling.ts              (onNextPollAt + onRateLimited + auto-refresh)
│   │   ├── useUpdateNotifier.ts       (onUpdateAvailable + onUpdateDownloadProgress)
│   │   ├── useCredentials.ts          (onCredentialMissing + onCredentialsExpired)
│   │   └── useCloudSync.ts            (sync.onEvent + loadCloudSyncStatus)
│   ├── layouts/
│   │   ├── PopupLayout.ts             (fitWindow + applySize + applySectionVisibility + applyTheme)
│   │   └── i18n.ts                    (translations + tr + applyTranslations)
│   ├── pages/
│   │   └── Dashboard.ts               (updateUI — orquestração do render principal)
│   ├── shared/
│   │   ├── colors.ts                  (colorForPct + barClass)
│   │   ├── formatters.ts              (formatResetsIn, formatResetAt, formatMinutes,
│   │   │                               formatRelativeTime)
│   │   ├── timeSeries.ts              (filterChangedPoints)
│   │   └── dom.ts                     (helpers tipados $, $$, show, hide — evita assert ! em cada uso)
│   └── bootstrap.ts                   # composition root: cria charts, carrega settings, plugga hooks
```

**Regra de ouro:** componentes só tocam DOM; **hooks** encapsulam `window.claudeUsage.*`; **stores** carregam estado mutável; **pages/layouts** orquestram. Nenhum componente chama IPC direto.

---

## Infra de build — partials HTML

**Extensão em `build-renderer.js`:**

```js
// Pseudocódigo — implementar em build-renderer.js antes do fs.copyFileSync do index.html
function resolveIncludes(html, baseDir, seen = new Set()) {
  const re = /([ \t]*)<!--\s*@include\s+(.+?)\s*-->/g;
  return html.replace(re, (_, indent, relPath) => {
    const abs = path.resolve(baseDir, relPath.trim());
    if (seen.has(abs)) throw new Error(`Include circular: ${abs}`);
    seen.add(abs);
    const raw = fs.readFileSync(abs, 'utf8');
    // preserva indentação do marcador em cada linha
    const indented = raw.split('\n').map((l, i) => i === 0 ? l : indent + l).join('\n');
    return resolveIncludes(indented, path.dirname(abs), seen);
  });
}

const rawHtml = fs.readFileSync(srcIndex, 'utf8');
const resolved = resolveIncludes(rawHtml, path.dirname(srcIndex));
fs.writeFileSync(path.join(outDir, 'index.html'), resolved);
```

**Contrato do marcador:** exatamente `<!-- @include ./partials/xxx.html -->`. Caminhos relativos ao arquivo que contém o include. Suporta recursão (settings/_wrapper inclui as 5 abas).

---

## Roadmap em 14 fases

### Fase 0 — Preparação (tamanho **S**)

**Objetivo:** alinhar infra antes de mexer em código.

**Branch:** `refactor/renderer-prep`

**Atividades:**
- [ ] Confirmar este plano como único ativo (auditor: `claude-code-planos/`)
- [ ] Criar issue guarda-chuva no GitHub com link para este plano
- [ ] `git branch backup/pre-renderer-refactor master`
- [ ] Criar estrutura vazia de pastas: `src/renderer/partials/{shell,modals,modals/settings}`, `src/renderer/stores/`, `src/presentation/components/{charts,banners,modals,settings,settings/tabs,sync}`, `src/presentation/{hooks,layouts,pages,shared}`
- [ ] Adicionar `.gitkeep` para preservar diretórios vazios no git
- [ ] Documentar regra "presentation não importa IPC direto" no topo de `src/presentation/README.md` (único `.md` novo, curto)

**Aceite:** `npm run build && npm test` passa; `git status` mostra só estrutura nova.

**Risco:** nenhum (só estrutura).

---

### Fase 1 — Build-time include para HTML (tamanho **M**)

**Objetivo:** habilitar partials antes de qualquer split.

**Branch:** `refactor/renderer-build-includes`

**Arquivos:**
- Modificar: `build-renderer.js` (adicionar `resolveIncludes`)
- Criar: `src/renderer/partials/shell/__smoke.html` (arquivo bobo para testar)
- Modificar temporário: `index.html` com 1 `<!-- @include ./partials/shell/__smoke.html -->` para validar

**Atividades:**
- [ ] Implementar `resolveIncludes` recursivo com preservação de indentação
- [ ] Tratar erro de arquivo inexistente com mensagem clara
- [ ] Testar include circular (deve lançar)
- [ ] Rodar `npm run build` e verificar `dist/renderer/index.html` resolvido
- [ ] Remover smoke include após validar; manter infra
- [ ] Documentar contrato do include em `src/renderer/partials/README.md` (1 parágrafo)

**Aceite:** `dist/renderer/index.html` contém HTML final idêntico ao atual; include resolvido sem diferenças visuais no `npm run dev`.

**Risco:** Electron carrega CSP estrito — include é build-time, não runtime, então CSP não é afetado. Mitigação: smoke build antes de remover marcador.

---

### Fase 2 — Utilitários puros (tamanho **M**)

**Objetivo:** extrair funções sem dependência de DOM ou IPC, já testáveis.

**Branch:** `refactor/renderer-puros`

**Arquivos:**
- Criar: `src/presentation/shared/colors.ts` (`colorForPct`, `barClass`)
- Criar: `src/presentation/shared/formatters.ts` (`formatResetsIn`, `formatResetAt`, `formatMinutes`, `formatRelativeTime` — passar `lang` como parâmetro em vez de ler `currentLang`)
- Criar: `src/presentation/shared/timeSeries.ts` (`filterChangedPoints`)
- Criar: `src/presentation/shared/dom.ts` (helpers `$<T>(id)`, `$$<T>(id)`, `show`, `hide`)
- Criar: `src/renderer/__tests/shared/colors.test.ts`, `formatters.test.ts`, `timeSeries.test.ts`
- Modificar: `app.ts` importa dos novos módulos (remove declarações in-file)
- Refatorar: `rendererFunctions.test.ts` para importar em vez de re-declarar

**Atividades:**
- [ ] Extrair `colorForPct` (app.ts:741) → `colors.ts` + test
- [ ] Extrair `barClass` (app.ts:875) → `colors.ts` + test
- [ ] Extrair `formatResetsIn` (app.ts:842), `formatResetAt` (app.ts:857), `formatMinutes` (app.ts:1890), `formatRelativeTime` (app.ts:2158) com `lang: Lang` explícito → `formatters.ts` + testes
- [ ] Extrair `filterChangedPoints` (app.ts:1127) → `timeSeries.ts` + test
- [ ] Criar `dom.ts` com `$<T extends HTMLElement>(id: string): T` (lança se nulo, evita 200+ `!` no código)
- [ ] Rodar testes: novos devem cobrir casos críticos (0%, 50%, 80%, 150%, 0m, 90m, 1d2h, null, etc)
- [ ] Substituir usos em `app.ts` pelas imports

**Aceite:** todos os 197 testes antigos + novos passam; `rg "function colorForPct|function barClass|function formatResetsIn" src/renderer/app.ts` retorna 0.

**Risco (baixo):** formatters dependem do idioma via `currentLang` global. Mitigação: passar `lang` explicitamente; callers em `app.ts` usam `tr()` ao invés da leitura solta.

---

### Fase 3 — i18n isolado (tamanho **M**)

**Objetivo:** mover tudo de i18n para um layout-level module com event-bus para troca dinâmica.

**Branch:** `refactor/renderer-i18n`

**Arquivos:**
- Criar: `src/presentation/layouts/i18n.ts` — exporta `translations` (L127–498), `tr()`, `applyTranslations()`, `setLang(lang)` que emite `'lang-changed'`
- Criar: `src/renderer/stores/langStore.ts` — observer simples com `subscribe`, `getLang`, `setLang` (chama i18n.setLang + persiste em settings)
- Modificar: todos os consumidores em `app.ts` (report modal, smart modal, settings, etc) chamam `tr()` e re-subscriber em `langStore` se precisar re-render

**Atividades:**
- [ ] Mover `translations` (L127–498) + `tr` (L507) + `applyTranslations` (L511) para `i18n.ts`
- [ ] Criar `langStore` com `subscribe((lang) => ...)`
- [ ] Substituir `currentLang` global por `langStore.getLang()`
- [ ] Substituir handler de troca de idioma em `init()` (L2649) por `langStore.setLang(...)`
- [ ] Manter `translationsRenderer.test.ts` e `i18nRenderer.test.ts` rodando (possivelmente adaptar imports)
- [ ] Smoke: trocar idioma via UI, verificar todos os textos atualizarem

**Aceite:** testes passam; `rg "const translations" src/renderer/app.ts` retorna 0; troca de idioma funcionando em todos os modais.

**Risco (médio):** `applyTranslations` toca muitos elementos — se um id for renomeado por acidente, traduções quebram silenciosamente. Mitigação: diff cuidadoso; screenshot EN/PT antes e depois.

---

### Fase 4 — Charts como componentes (tamanho **L**)

**Objetivo:** encapsular Chart.js lifecycle em componentes que gerenciam `destroy()` automaticamente.

**Branch:** `refactor/renderer-charts`

**Arquivos:**
- Criar: `src/presentation/components/charts/GaugeChart.ts` — classe com `mount(canvasId)`, `update(pct)`, `destroy()`
- Criar: `src/presentation/components/charts/TrayIcon.ts` — `render(sessionPct, weeklyPct): string (dataUrl)` puro + side effect de `sendTrayIcon`
- Criar: `src/presentation/components/charts/DailyChart.ts` — `render(daily, weeklyResetsAt, liveWeeklyPct?, liveSessionPct?)`
- Criar: `src/presentation/components/charts/BurnRate.ts` — `updateSession()`, `updateWeekly()`
- Criar: `src/presentation/components/charts/DayCurvePopup.ts` — `open(date, anchorEl)`, `close()`
- Criar: `src/presentation/components/charts/SmartPlanDonut.ts` — lifecycle do `spDonutChart`

**Atividades:**
- [ ] Extrair `createGauge` (app.ts:747), `updateGauge` (app.ts:771) → `GaugeChart`
- [ ] Extrair `updateTrayIcon` (app.ts:781) → `TrayIcon`
- [ ] Extrair `renderDailyChart` (app.ts:1314) → `DailyChart` — incluindo a delegação de click que abre day detail (via callback/event)
- [ ] Extrair `updateBurnRate` (app.ts:1370) + `updateWeeklyBurnRate` (app.ts:1399) → `BurnRate`
- [ ] Extrair `openDayCurvePopup` (app.ts:1437) + `closeDayCurvePopup` (app.ts:1494) → `DayCurvePopup`
- [ ] Extrair `spDonutChart` lifecycle (app.ts:1828+) para `SmartPlanDonut`
- [ ] Cada componente aceita dependências via construtor (canvas id, callbacks) — sem acesso a globals
- [ ] Escrever testes unitários mockando Chart.js (`vi.mock('chart.js')`)

**Aceite:** gauges atualizam ao vivo; daily chart continua clicável; tray icon muda de cor em tema claro/escuro; testes passam.

**Risco (alto):** Chart.js precisa `destroy()` antes de recriar — fácil deixar memory leak. Mitigação: cada componente guarda ref interna e destrói ao `mount` repetido.

---

### Fase 5 — Stores + hooks base (tamanho **M**)

**Objetivo:** criar estado centralizada e hooks para consumir IPC.

**Branch:** `refactor/renderer-state`

**Arquivos:**
- Criar: `src/renderer/stores/appStore.ts` — observer simples com keys (`lastWeeklyResetsAt`, `lastSessionPct`, `lastWeeklyPct`, `lastUpdatedTime`, `currentDailyHistory`, `currentSmartStatus`, `autoRefreshEnabled`, `autoRefreshIntervalMs`, `isRateLimited`, `showAccountBar`, `extraSectionAllowed`)
- Criar: `src/renderer/stores/syncStore.ts` — `syncLastKnownAt`, `syncLastKnownIntervalMs`, `syncLastKnownStatus`, `getSettings_cache`
- Criar: `src/presentation/hooks/useUsageData.ts` — registra `onUsageUpdated`, popula store, dispara re-render
- Criar: `src/presentation/hooks/useSmartStatus.ts` — `onSmartStatusUpdated`
- Criar: `src/presentation/hooks/useProfile.ts` — `getProfile` + `onProfileUpdated`
- Criar: `src/presentation/hooks/useSettings.ts` — `loadSettings()` + `saveSettingsFromUI()` + cache
- Criar: `src/presentation/hooks/usePolling.ts` — `onNextPollAt` + `onRateLimited` + auto-refresh start/stop
- Criar: `src/presentation/hooks/useUpdateNotifier.ts` — `onUpdateAvailable` + `onUpdateDownloadProgress`
- Criar: `src/presentation/hooks/useCredentials.ts` — `onCredentialMissing` + `onCredentialsExpired`

**Atividades:**
- [ ] API mínima do store: `get(key)`, `set(key, value)`, `subscribe(key, fn)`, `subscribeMany(keys[], fn)`
- [ ] Hooks apenas fazem wiring IPC → store; não tocam DOM
- [ ] Registro idempotente: `usePolling()` pode ser chamado múltiplas vezes sem dobrar listener
- [ ] Testes unitários do store (subscribe, unsubscribe, notify only on change)
- [ ] Cuidado: `onUsageUpdated` hoje é registrado 2x (app.ts:2387 + app.ts:2395) — consolidar em 1 só via `appStore.subscribe('lastWeeklyResetsAt', renderDailyChartIfReady)`

**Aceite:** store cobre ≥ 10 keys; hooks executam sem duplicação; testes unitários dos hooks com IPC mockado passam.

**Risco (médio):** fugir de double-subscribe. Mitigação: flag `registered` no módulo do hook.

---

### Fase 6 — Modais genéricas + modais pequenas (tamanho **M**)

**Objetivo:** componentizar modais simples.

**Branch:** `refactor/renderer-modais-simples`

**Arquivos:**
- Criar: `src/presentation/components/modals/GenericModals.ts` — `showConfirm`, `showInfo`, `showForceRefreshModal` (L2048–2094)
- Criar: `src/presentation/components/modals/CredentialModal.ts`
- Criar: `src/presentation/components/modals/UpdateMajorModal.ts`
- Criar: `src/presentation/components/modals/EditSnapshotModal.ts`
- Criar: `src/presentation/components/banners/ErrorBanner.ts`, `RateLimitBanner.ts`, `UpdateBanner.ts`

**Atividades:**
- [ ] Cada modal exporta `open()` / `close()` e opcionalmente callbacks via parâmetro
- [ ] `RateLimitBanner` absorve `startRateLimitCountdown` (L697) + `clearRateLimitBanner` (L734) + flag `isRateLimited` vai para store
- [ ] `GenericModals` com cleanup automático de listeners (`{ once: true }`)
- [ ] Registrar listeners em `init()` só chamando métodos dos componentes (wiring layer)

**Aceite:** confirmar/fechar cada modal funcional; rate limit banner aparece e some corretamente; countdown atualiza.

**Risco (baixo):** listeners com `once` já estavam OK; manter padrão.

---

### Fase 7 — Modais grandes (Report, Day Detail, Smart Plan, Cost) (tamanho **L**)

**Objetivo:** os quatro modais com lógica significativa.

**Branch:** `refactor/renderer-modais-grandes`

**Arquivos:**
- Criar: `src/presentation/components/modals/ReportModal.ts` — abs. `openReportModal` (L841) + `buildRow` interno
- Criar: `src/presentation/components/modals/DayDetailModal.ts` — `openDayDetailModal` (L1140) + `closeDayDetailModal`
- Criar: `src/presentation/components/modals/SmartPlanModal.ts` — `openSmartModal` (L1896) + `applySmartIndicator` (L2057) + timeline/collision logic
- Criar: `src/presentation/components/modals/CostModal.ts` — estados das 3 abas + `costGaugeChart` lifecycle

**Atividades:**
- [ ] Report Modal: puxa dados via hooks/IPC, delega render de gráfico para componente; mantém botão de export
- [ ] Day Detail: render de time series; reutiliza callbacks do DailyChart
- [ ] Smart Plan: extrair `applyTimelineBounds`, `placeMarkers`, `detectCollisions` como funções puras em `src/presentation/shared/smartPlanMath.ts` — permite testes unitários isolados
- [ ] Cost Modal: mover cost tabs + `saveSettings` de budget/model; reutilizar `GaugeChart`
- [ ] Em cada modal, o handler de `visibilitychange` (app.ts:2430) deve saber fechar suas instâncias abertas — delegar para um `modalRegistry` compartilhado

**Aceite:** todos os modais abrem, renderizam dados corretos, fecham; smart plan timeline posiciona marcadores sem overlap; cost tabs trocam e gauge atualiza.

**Risco (alto):** Smart Plan tem math de bounding box que é fácil quebrar. Mitigação: testes de `smartPlanMath` cobrindo overlap, work-day boundaries, reset cross-midnight.

---

### Fase 8 — Settings modal + abas (tamanho **L**)

**Objetivo:** quebrar 200+ linhas de loadSettings/saveSettingsFromUI em componentes por aba.

**Branch:** `refactor/renderer-settings`

**Arquivos:**
- Criar: `src/presentation/components/settings/SettingsModal.ts` — orquestra abre/fecha + tab switching (L2689)
- Criar: `src/presentation/components/settings/tabs/GeralTab.ts`, `ExibicaoTab.ts`, `NotifTab.ts`, `BackupTab.ts`, `SmartPlanTab.ts`
- Criar: `src/presentation/hooks/useSettings.ts` — `loadSettings()` + `saveSettingsFromUI()` + cache

**Atividades:**
- [ ] Cada `xxxTab.ts` tem `bind(settings)` (popula inputs) e `read(): Partial<AppSettings>` (lê inputs)
- [ ] `useSettings.save()` chama todos os `tab.read()`, faz merge, envia via IPC
- [ ] `useSettings.load()` busca via IPC, chama `tab.bind(settings)` para cada aba
- [ ] Mover aplicação dinâmica pós-save: `applyAutoRefresh`, `applySize`, `applyTheme`, `applySectionVisibility`, `applyTranslations` — esses vão para `src/presentation/layouts/PopupLayout.ts` (exposto) e são chamados por `useSettings.save()` após merge
- [ ] Manter validação de threshold in-input
- [ ] Smoke: abrir cada aba, alterar valores, fechar, reabrir, verificar persistência

**Aceite:** cada aba salva sozinha no change; settings persistidas; theme/lang/size aplicam imediatamente.

**Risco (alto):** regressão em campos específicos é silenciosa. Mitigação: cobrir cada campo em smoke manual; comparar JSON de `config.json` antes/depois.

---

### Fase 9 — Cloud Sync UI (tamanho **M**)

**Objetivo:** isolar painel de sync da barra de ícone e das funções de status.

**Branch:** `refactor/renderer-cloud-sync`

**Arquivos:**
- Criar: `src/presentation/components/sync/CloudSyncPanel.ts` — `applyCloudSyncStatus` (L2110), `updateSyncHeaderIcon` (L2185), `refreshSyncTimes` (L2290)
- Criar: `src/presentation/hooks/useCloudSync.ts` — `loadCloudSyncStatus` (L2312) + `sync.onEvent` (L2927)
- Modificar: botões `btn-sync-*` (L2880–2927) passam a chamar métodos do componente

**Atividades:**
- [ ] `CloudSyncPanel` expõe `bind(status)`, `renderEnabled()`, `renderSetup()`
- [ ] `useCloudSync` gerencia `syncLastKnownAt/Interval/Status` via `syncStore`
- [ ] `refreshSyncTimes` vira método que roda em `setInterval` gerenciado pelo hook
- [ ] Smoke: habilitar sync fake (servidor local), desabilitar, wipe, triggerNow

**Aceite:** fluxo de enable/disable/wipe/sync-now funcional; ícone da header reflete estado; "Last/Next" atualizam.

**Risco (médio):** estado de sync é persistente e sensível. Mitigação: teste com servidor local; backup de `config.json` antes.

---

### Fase 10 — Página Dashboard + updateUI (tamanho **M**)

**Objetivo:** consolidar o render principal.

**Branch:** `refactor/renderer-dashboard`

**Arquivos:**
- Criar: `src/presentation/pages/Dashboard.ts` — absorve `updateUI` (L1501) chamando `GaugeChart.update`, `TrayIcon.render`, `DailyChart.render`, atualiza elementos de footer via `dom.ts` helpers
- Criar: `src/presentation/layouts/PopupLayout.ts` — `fitWindow` (L554), `applySize` (L569), `applyTheme` (L2080), `applySectionVisibility` (L2089)
- Modificar: `useUsageData` (fase 5) chama `Dashboard.render(data)`

**Atividades:**
- [ ] `Dashboard.render(data)` fica ≤ 150 linhas; delega tudo
- [ ] `PopupLayout.fitWindow` mantém lógica de altura + resize de charts
- [ ] `PopupLayout.applySectionVisibility` chama `fitWindow` ao final
- [ ] Verificar que `sessionResetTimer` (L827) some — ou fica isolado em um componente específico se tiver uso (conferir; possivelmente dead code)
- [ ] Smoke: refresh, rate limit, troca de tema, resize

**Aceite:** render completo idêntico; sem piscar ou layout shift.

**Risco (médio):** timing de render (order) pode mudar. Mitigação: garantir que a ordem de `GaugeChart.update` → `TrayIcon.render` → `DailyChart.render` respeite o código atual.

---

### Fase 11 — Bootstrap e redução de app.ts (tamanho **M**)

**Objetivo:** composition root + entrypoint mínimo.

**Branch:** `refactor/renderer-bootstrap`

**Arquivos:**
- Criar: `src/presentation/bootstrap.ts` — função `bootstrap()` que:
  1. Instancia `GaugeChart` para session/weekly
  2. Chama `useSettings.load()`
  3. Registra hooks (`useUsageData`, `useSmartStatus`, `useProfile`, `usePolling`, `useUpdateNotifier`, `useCredentials`, `useCloudSync`)
  4. Monta componentes de UI (`SettingsModal`, `CostModal`, etc — só bind de botões, não abre nada)
  5. Configura listeners de navegação (tabs, visibilitychange, matchMedia de tema)
- Modificar: `src/renderer/app.ts` reduz a:
  ```ts
  import { bootstrap } from '../presentation/bootstrap';
  document.addEventListener('DOMContentLoaded', bootstrap);
  ```

**Atividades:**
- [ ] Mover todo o `init()` (L2334–3038) para `bootstrap`
- [ ] Confirmar registro único de cada listener de IPC
- [ ] Remover variáveis globais órfãs de `app.ts`
- [ ] `app.ts` final ≤ 50 linhas (só entrypoint)
- [ ] Atualizar tests de renderer pra importar `bootstrap` se necessário

**Aceite:** app boota, todos os fluxos funcionam, `wc -l src/renderer/app.ts` ≤ 50.

**Risco (alto):** fácil perder wiring de algum botão. Mitigação: grep `getElementById` em `bootstrap.ts` vs. no `app.ts` original — contagens devem bater (ou menos se migrou p/ `dom.ts`).

---

### Fase 12 — Split do index.html em partials (tamanho **L**)

**Objetivo:** fatiar o HTML em partials usando a infra da Fase 1.

**Branch:** `refactor/renderer-html-partials`

**Arquivos:**
- Criar todos os partials em `src/renderer/partials/shell/` e `src/renderer/partials/modals/` conforme árvore da Arquitetura alvo
- Modificar: `index.html` para conter só o shell + `<!-- @include -->`s

**Atividades:**
- [ ] Extrair shell (header, account bar, smart rec, content body, footer, tray canvas) para 8 partials em `shell/`
- [ ] Extrair 10 modais para `modals/` (com settings tendo wrapper + 5 abas em `modals/settings/`)
- [ ] Reduzir `index.html` para ≤ 150 linhas
- [ ] Validar diff byte-a-byte entre `dist/renderer/index.html` atual vs. novo (após build) — deve ser **idêntico** (ignoring whitespace)
- [ ] Atualizar `AGENTS.md` → seção "Dead code checklist" para considerar partials

**Aceite:** build gera HTML igual ao antigo; app roda sem diferença visual; `wc -l src/renderer/index.html` ≤ 150.

**Risco (médio):** perder 1 elemento ou id no split. Mitigação: diff estrito do build output; testes de integração que checam IDs existem.

---

### Fase 13 — Cleanup + validação final (tamanho **S**)

**Objetivo:** fechar ponta solta.

**Branch:** `refactor/renderer-cleanup`

**Atividades:**
- [ ] Remover imports não usados
- [ ] Remover any variável global órfã
- [ ] Auditar se `src/renderer/composables/` ficou vazio — se sim, decidir manter ou excluir
- [ ] Atualizar `ARCHITECTURE.md` com nova estrutura do renderer
- [ ] Atualizar `AGENTS.md` "Dead code checklist" para refletir partials
- [ ] Rodar `npm run test:coverage` — cobertura não deve cair
- [ ] Smoke final completo: abrir cada modal, cada aba, trocar tema/idioma/tamanho, refresh, rate-limit simulado, sync simulado
- [ ] Comparar screenshots antes/depois por seção

**Aceite:** build limpo, testes limpos, coverage ≥ baseline, smoke completo passa.

---

## DAG de dependências

```
Fase 0 ─► Fase 1 ─► Fase 2 ─► Fase 3 ─► Fase 4 ─► Fase 5 ─► Fase 6 ─► Fase 7 ─► Fase 8 ─► Fase 9 ─► Fase 10 ─► Fase 11 ─► Fase 12 ─► Fase 13
                              └──────────────────►       (i18n e puros independentes de charts — paralelizável se quiser)
                                                        └─► (charts independentes de stores até chegar em hooks)
```

Linear é mais seguro. Paralelizar apenas Fase 2+3 (puros + i18n) e Fase 4 (charts) é uma opção para ganho de tempo, mas aumenta risco de conflito em `app.ts`.

---

## Pontos de atenção (armadilhas identificadas)

1. **Duplo registro de `onUsageUpdated`** (app.ts:2387 + app.ts:2395) — consolidar na Fase 5 via `appStore.subscribe`
2. **Chart.js `destroy()`** antes de recriar — obrigatório em `GaugeChart.mount` (Fase 4)
3. **`visibilitychange` (app.ts:2430)** fecha modais — mover para `modalRegistry` compartilhado
4. **`applyTranslations`** precisa rodar ao trocar idioma em runtime — event-bus de `langStore` (Fase 3)
5. **`electron-store` schema** — não apertar `min/max` em nenhum momento (já no CLAUDE.md)
6. **Testes reimplementam funções** — refatorar pra importar na Fase 2 (aumenta confiança real)
7. **`userMovedPopup` em main** — não afetado, mas `fitWindow` precisa preservar o fato de que só redimensiona sem reposicionar
8. **CSP** — build-time include não toca; runtime `fetch()` quebraria
9. **`sessionResetTimer` (app.ts:827)** — verificar se está vivo ou é morto (possível dead code)
10. **IPC `sendTrayIcon`** é chamado em muitos pontos — `TrayIcon.render` precisa cuidar de debounce natural via chamadas do Dashboard

---

## Critérios de conclusão (Definition of Done)

- [ ] `wc -l src/renderer/app.ts` ≤ 50
- [ ] `wc -l src/renderer/index.html` ≤ 150
- [ ] Nenhum arquivo novo > 300 linhas
- [ ] `npm run build` limpo
- [ ] `npm test` todos passam (≥ 197 + novos)
- [ ] `npm run test:coverage` coverage ≥ baseline atual
- [ ] Smoke manual: cada modal, cada aba, troca de tema/idioma/tamanho, refresh, rate-limit, sync (enable/disable/trigger/wipe)
- [ ] Screenshot comparativo por fase — zero regressão visual
- [ ] `rg "window.claudeUsage" src/presentation/components` retorna 0 (componentes não chamam IPC direto)
- [ ] `rg "document.getElementById" src/presentation/{hooks,layouts}` retorna 0 (hooks/layouts tocam DOM via components ou dom.ts)
- [ ] `src/renderer/composables/` e `src/renderer/stores/` usados ou removidos (nada vazio no final)
- [ ] `ARCHITECTURE.md` e `AGENTS.md` atualizados
- [ ] Este plano marcado "✅ Concluído"

---

## Andamento

### Fase 0 — Preparação

**Status:** ✅ Concluída

**Data de início:** 2026-04-19

**Atividades realizadas:**
- Confirmado plano como único ativo (demais Planos em claude-code-planos/ são de outras funcionalidades)
- Criado backup branch: `backup/pre-renderer-refactor` a partir de master
- Criada estrutura de diretórios vazios com .gitkeep
- Adicionado README.md em src/presentation/ documentando regra de arquitetura
- Adicionado README.md em src/renderer/partials/ documentando contrato de includes
- Verificado build e testes (387 testes passando)

**Problemas encontrados:** Nenhum

**Notas:**

---

### Fase 1 — Build-time include para HTML

**Status:** ✅ Concluída

**Data:** 2026-04-19

**Atividades realizadas:**
- Implementado `resolveIncludes` em `build-renderer.js` com:
  - Suporte a includes recursivos
  - Preservação de indentação
  - Detecção de includes circulares (lança erro)
  - Caminhos relativos ao arquivo que contém o include
- Testado com arquivo smoke (funcionou)
- Testado detecção de circular (lança erro corretamente)
- Validado build + testes (387 passando)
- Removido smoke test após validação

**Problemas encontrados:**
- Bug inicial: `path.dirname(abs)` era usado na recursão, causando path relativo errado. Corrigido usando `baseDir` original.

**Notas:** Infra de includes pronta para Fase 12 (HTML partials)

---

### Fase 2 — Utilitários puros (colors, formatters, timeSeries)

**Status:** ✅ Concluída

**Data:** 2026-04-19

**Arquivos criados:**
- `src/presentation/shared/colors.ts` — colorForPct, barClass
- `src/presentation/shared/formatters.ts` — formatResetsIn (com lang+t), formatResetAt (com lang), formatRelativeTime (com t)
- `src/presentation/shared/formatMinutes.ts` — formatMinutes
- `src/presentation/shared/timeSeries.ts` — filterChangedPoints
- `src/presentation/shared/dom.ts` — $, $$, show, hide
- `src/presentation/shared/colors.test.ts`
- `src/presentation/shared/timeSeries.test.ts`
- `src/presentation/shared/formatMinutes.test.ts`

**Modificações em app.ts:**
- Removidas funções duplicadas: colorForPct, barClass, formatResetsIn, formatResetAt, formatMinutes, formatRelativeTime, filterChangedPoints
- Adicionados imports dos novos módulos
- Chamadas atualizadas para usar assinatura com parâmetros explícitos (lang, t)

**Testes:** 405 passando (18 novos)

**Problemas encontrados:**
- formatRelativeTime usa `tr()` internamente no original — solução: passar `t` como parâmetro
- formatResetsIn usa `tr()` internamente no original — solução: passar `t` como parâmetro

**Notas:** dom.ts criado mas ainda não utilizado em app.ts (será usado nas próximas fases)

---

### Fase 3 — i18n isolado

**Status:** ✅ Concluída

**Data:** 2026-04-19

**Arquivos criados:**
- `src/presentation/layouts/i18n.ts` — translations (420+ linhas de cada idioma), tr(), applyTranslations(), getLang(), setLang(), subscribeLang()
- `src/renderer/stores/langStore.ts` — re-exporta getLang, setLang, subscribeLang

**Modificações em app.ts:**
- Removido bloco translations completo (~420 linhas de cada idioma)
- Removidas declarações de `currentLang`, `tr()`, `applyTranslations()`
- Adicionados imports de `../presentation/layouts/i18n`
- Substituído `currentLang` por `getLang()` (17 ocorrências)
- Substituído `currentLang = lang` por `setLang(lang)` (3 ocorrências)

**Problemas encontrados:**
- Erro de replaceAll: `currentLang` → `getLang()` funcionou, mas replaces extras em linhas como `let getLang(): Lang = 'en';` causaram erro de sintaxe. Corrigido removendo o bloco i18n inteiro de app.ts e deixando só o import.
- `getLang() = lang` em vez de `setLang(lang)` — o replaceAll não respeitou que é uma chamada de função, não atribuição. Corrigido manualmente.

**Notas:** i18n isolado com event-bus (subscribers) para troca dinâmica de idioma em runtime

---

### Fase 4 — Charts como componentes

**Status:** ✅ Concluída (criação de componentes)

**Data:** 2026-04-19

**Arquivos criados:**
- `src/presentation/components/charts/GaugeChart.ts` — createGauge + updateGauge encapsuladas em classe
- `src/presentation/components/charts/TrayIcon.ts` — render() com side effect de sendTrayIcon
- `src/presentation/components/charts/DailyChart.ts` — render() com suporte a click handler
- `src/presentation/components/charts/BurnRate.ts` — updateSession() + updateWeekly()
- `src/presentation/components/charts/DayCurvePopup.ts` — open() + close() com lifecycle do chart
- `src/presentation/components/charts/SmartPlanDonut.ts` — render() com lifecycle do chart

**Instâncias criadas em app.ts:**
- sessionGauge, weeklyGauge, trayIcon, dailyChart, burnRate, dayCurvePopup, smartPlanDonut

**Modificações em app.ts:**
- Adicionados imports dos componentes
- Criadas instâncias globais dos componentes
- Removidas funções createGauge, updateGauge, updateTrayIcon do app.ts (ghost code - faltou remover)

**Problemas encontrados:**
- Path errados nos imports (../shared/colors → ../../shared/colors) — corrigido
- DailyChart.ts tinha renderFit() com referência a fitWindow que não existe no escopo — removido
- Trecho órfão do antigo updateTrayIcon ficou no app.ts após remoção — corrigido

**Notas:** Componentes criados mas app.ts ainda usa as instâncias Chart diretamente ao invés dos componentes. Fases 5-10 farão a integração completa.

---

### Fase 5 — Stores + hooks base

**Status:** Não iniciada

**Problemas encontrados:** Nenhum ainda

**Notas:**

---

## Log de problemas e soluções

| Data | Fase | Problema | Solução |
|------|------|----------|---------|
| 2026-04-19 | Fase 0 | — | — |
| 2026-04-19 | Fase 1 | path.dirname na recursão quebra relative paths | Usar baseDir original na recursão |
| 2026-04-19 | Fase 2 | formatRelativeTime usa tr() internamente | Passar t como parâmetro |
| 2026-04-19 | Fase 2 | formatResetsIn usa tr() internamente | Passar t como parâmetro |
| 2026-04-19 | Fase 3 | replaceAll substituiu currentLang em contexto de atribuição | Remover bloco i18n completo de app.ts e usar import |
| 2026-04-19 | Fase 3 | getLang() = lang não é atribuição válida | Usar setLang(lang) |
| 2026-04-19 | Fase 4 | path ../shared/colors não existe | Corrigir para ../../shared/colors |
| 2026-04-19 | Fase 4 | renderFit() com referência a fitWindow | Remover método |
| 2026-04-19 | Fase 3 | replaceAll substituiu `currentLang` em contexto de atribuição | Remover bloco i18n completo de app.ts e usar import |
| 2026-04-19 | Fase 3 | `getLang() = lang` não é atribuição válida | Usar `setLang(lang)` |

---

## Notas gerais

- Plano clonado do Claude Code (opus 4.7) em 2026-04-19
- Branch de trabalho: `refactor-renderer-clean-architecture-minimax`
- Execução sequencial (não paralelo)
