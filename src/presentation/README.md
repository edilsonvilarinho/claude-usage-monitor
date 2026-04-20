# src/presentation/

**Regra de ouro:** componentes só tocam DOM; **hooks** encapsulam `window.claudeUsage.*`; **stores** carregam estado mutável; **pages/layouts** orquestram. **Nenhum componente ou hook chama IPC direto.**

## Estrutura

- `components/` — Componentes UI (charts, modals, banners, settings, sync)
- `hooks/` — Wiring entre IPC e stores (não tocam DOM)
- `layouts/` — Layouts globais (i18n, PopupLayout)
- `pages/` — Páginas/composição de render (Dashboard)
- `shared/` — Utilitários puros (colors, formatters, dom, timeSeries)

## Importação

- Componentes podem importar de `hooks`, `shared`, e stores
- Hooks podem importar de `shared` e stores
- **NÃO** importar de `../renderer/app.ts` ou qualquer arquivo em `src/renderer/` (exceto stores que são co-locados)
