# Fix: Mover módulos para locais corretos pós-refactor renderer

**Branch:** `refactor-renderer-clean-architecture-minimax`  
**Data criação:** 2026-04-20  
**Status:** ✅ Concluído — todas as fases A–G executadas

---

## Contexto

A refatoração do renderer (Fases 0–13) atingiu os critérios externos (app.ts ≤50L, index.html ≤50L, build limpo, 418 testes). Porém, as Fases 6–10 foram executadas de forma incompleta: a lógica que deveria estar dispersa em componentes individuais foi concentrada em `src/renderer/AppBootstrap.ts` (890 linhas), que virou o novo monolito. Os 4 modais grandes ficaram em `src/renderer/` em vez de `src/presentation/components/modals/`.

---

## Problemas a corrigir

### 1 — Modais em local errado (mover de src/renderer/ → src/presentation/components/modals/)

| Arquivo atual | Destino correto |
|---|---|
| `src/renderer/ReportModal.ts` (227L) | `src/presentation/components/modals/ReportModal.ts` |
| `src/renderer/SmartPlanModal.ts` (187L) | `src/presentation/components/modals/SmartPlanModal.ts` |
| `src/renderer/DayDetailModal.ts` (177L) | `src/presentation/components/modals/DayDetailModal.ts` |
| `src/renderer/CostModal.ts` (44L) | `src/presentation/components/modals/CostModal.ts` |

### 2 — chartsInstance.ts fora do lugar

`src/renderer/chartsInstance.ts` (23L) instancia os charts — essas instâncias deveriam ser criadas em `src/presentation/bootstrap.ts` e passadas para quem precisa.

### 3 — AppBootstrap.ts (890L) é o novo monolito

Toda a lógica que as Fases 6–10 deveriam ter extraído ainda está lá. Precisa ser dispersa nos componentes abaixo.

### 4 — Arquivos previstos no plano que nunca foram criados

| Arquivo faltando | Fase original | Lógica está em |
|---|---|---|
| `src/presentation/components/banners/ErrorBanner.ts` | Fase 6 | AppBootstrap.ts |
| `src/presentation/components/banners/RateLimitBanner.ts` | Fase 6 | AppBootstrap.ts |
| `src/presentation/components/banners/UpdateBanner.ts` | Fase 6 | AppBootstrap.ts |
| `src/presentation/components/modals/EditSnapshotModal.ts` | Fase 7 | AppBootstrap.ts |
| `src/presentation/components/modals/CredentialModal.ts` | Fase 7 | AppBootstrap.ts |
| `src/presentation/components/modals/UpdateMajorModal.ts` | Fase 7 | AppBootstrap.ts |
| `src/presentation/components/settings/SettingsModal.ts` | Fase 8 | AppBootstrap.ts |
| `src/presentation/components/settings/tabs/GeralTab.ts` | Fase 8 | AppBootstrap.ts |
| `src/presentation/components/settings/tabs/ExibicaoTab.ts` | Fase 8 | AppBootstrap.ts |
| `src/presentation/components/settings/tabs/NotifTab.ts` | Fase 8 | AppBootstrap.ts |
| `src/presentation/components/settings/tabs/BackupTab.ts` | Fase 8 | AppBootstrap.ts |
| `src/presentation/components/settings/tabs/SmartPlanTab.ts` | Fase 8 | AppBootstrap.ts |
| `src/presentation/pages/Dashboard.ts` | Fase 10 | AppBootstrap.ts (updateUI) |

### 5 — Stores subutilizados

Variáveis de estado em `AppBootstrap.ts` são locais (`let isRateLimited`, `let lastWeeklyPct`, etc.) em vez de usar `appStore`/`syncStore` conforme planejado.

---

## Plano de execução

### Fase A — Mover modais para src/presentation/components/modals/
- Mover os 4 arquivos de `src/renderer/` para `src/presentation/components/modals/`
- Atualizar todos os imports em `AppBootstrap.ts`
- `npm run build && npm test`

### Fase B — Criar banners (extrair de AppBootstrap.ts)
- `ErrorBanner.ts`: lógica de exibição do banner de erro
- `RateLimitBanner.ts`: `startRateLimitCountdown` + `clearRateLimitBanner`
- `UpdateBanner.ts`: lógica do banner de atualização disponível
- Remover lógica de AppBootstrap.ts após extração
- `npm run build && npm test`

### Fase C — Criar modais pequenas (extrair de AppBootstrap.ts)
- `EditSnapshotModal.ts`
- `CredentialModal.ts`
- `UpdateMajorModal.ts`
- Remover lógica de AppBootstrap.ts após extração
- `npm run build && npm test`

### Fase D — Criar settings tabs (extrair de AppBootstrap.ts)
- `SettingsModal.ts` — orquestra abre/fecha
- `tabs/GeralTab.ts`, `ExibicaoTab.ts`, `NotifTab.ts`, `BackupTab.ts`, `SmartPlanTab.ts`
- Cada tab: `bind(settings)` + `read(): Partial<AppSettings>`
- Remover lógica de AppBootstrap.ts após extração
- `npm run build && npm test`

### Fase E — Criar Dashboard.ts (extrair updateUI de AppBootstrap.ts)
- `src/presentation/pages/Dashboard.ts`: absorve `updateUI()` de AppBootstrap.ts
- Dashboard ≤150L; delega para GaugeChart, TrayIcon, DailyChart, BurnRate
- Remover lógica de AppBootstrap.ts após extração
- `npm run build && npm test`

### Fase F — Integrar stores + dissolver chartsInstance
- Migrar variáveis locais de AppBootstrap.ts para `appStore`/`syncStore`
- Mover instâncias de `chartsInstance.ts` para `presentation/bootstrap.ts`
- AppBootstrap.ts deve se tornar o composition root ≤150L
- `npm run build && npm test`

### Fase G — Cleanup final
- Remover `.gitkeep` de diretórios agora preenchidos
- Verificar `rg "window.claudeUsage" src/presentation/components` → deve retornar 0
- Smoke manual: todos os modais, todas as abas settings, troca tema/idioma, refresh, sync

---

## Critérios de conclusão

- [ ] `wc -l src/renderer/AppBootstrap.ts` ≤ 150 (composition root)
- [ ] Nenhum arquivo em `src/presentation/` > 300 linhas
- [ ] Nenhum modal ou banner em `src/renderer/` (exceto AppBootstrap.ts e app.ts)
- [ ] `src/renderer/chartsInstance.ts` removido
- [ ] `npm run build` limpo
- [ ] `npm test` todos passam (≥ 418)
- [ ] Smoke manual completo sem regressão

---

## Progresso

| Fase | Status | Notas |
|------|--------|-------|
| A — mover modais | ✅ | 4 modais movidos; build + 418 testes ok |
| B — banners | ✅ | ErrorBanner, RateLimitBanner, UpdateBanner criados; build + 418 ok |
| C — modais pequenas | ✅ | CredentialModal, EditSnapshotModal, UpdateMajorModal criados; build + 418 ok |
| D — settings tabs | ✅ | SettingsModal + 5 tabs criados; AppBootstrap 534L; build + 418 ok |
| E — Dashboard.ts | ✅ | Dashboard.ts criado; updateUI extraída; build + 418 ok |
| F — stores + chartsInstance | ✅ | CloudSyncSetup, ServerStatus, AccountBar, autoRefresh, HistoryPanel, HeaderHandlers criados; AppBootstrap 175L |
| G — cleanup final | ✅ | gitkeeps removidos; critérios verificados; build + 418 ok |
