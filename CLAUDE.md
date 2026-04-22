# CLAUDE.md

## Idioma
- Sempre responda ao usuário em **pt-br**
- Mensagens de commit devem ser escritas em **pt-br**

## Commands
```bash
npm run dev          # compile main + start Electron (system tray)
npm run build        # compile main TS + bundle renderer
npm run dist         # NSIS installer + portable EXE → dist-build/
npm run dist:zip     # zip installer + portable → dist-build/
npm run release      # dist + dist:portable + zip → dist-build/
```
Run `npm test` after changes to services. Run `npm run build` and confirm clean exit before committing.

**Testes Playwright obrigatórios:** todo código adicionado ou alterado deve ter testes E2E Playwright correspondentes em `tests/e2e/`. Execute `npx playwright test` para validar.

## Release checklist (`npm run dist`)
Before publishing:
1. `dist-build/*.exe` sizes are ~70–90 MB — if much larger, old artifacts leaked in
2. `dist/` contains only compiled JS/HTML (no `.exe`, no `win-unpacked/`)

## Clean Architecture — Regra Inviolável

Todo código novo ou modificado deve respeitar Clean Architecture. Sem exceções.

**Camadas e onde vive cada coisa:**
| Camada | Pasta | O que contém |
|--------|-------|--------------|
| Domain | `src/domain/` | Entidades, tipos, regras de negócio puras (sem dependências externas) |
| Application | `src/application/` | Use cases, mapeadores, orquestração entre domain e infra |
| Infrastructure | `src/services/`, `src/main.ts` | Electron, IPC, APIs externas, storage |
| Presentation | `src/presentation/` | Páginas, layouts, componentes, formatters, i18n |
| Renderer bootstrap | `src/renderer/` | Apenas inicialização e stores reativos |

**Proibido:**
- Presentation importar de `src/services/` ou `src/main.ts` diretamente
- Domain importar de qualquer outra camada
- Formatters de UI com lógica de negócio (cálculos, regras)
- Funções com parâmetros não utilizados (dead params)
- Imports de módulo errado (ex: `Lang` de `renderer/app` em vez de `presentation/layouts/i18n`)

**Obrigatório ao criar/modificar código:**
- Identificar a camada correta antes de escrever
- Respeitar o fluxo: Domain ← Application ← Infrastructure / Presentation
- Tipos e contratos definidos na camada mais interna que os usa

## Architecture

```
Anthropic API → usageApiService → pollingService → IPC:usage-updated → renderer
                                               → IPC:rate-limited  → countdown
                                               → notificationService → tray tooltip
```

`src/services/` — credenciais OAuth, API usage, polling adaptativo, settings (electron-store), notificações.

## Key notes
- `utilization` pode exceder 1.0 (ex: `16.0` = 1600%). UI limita gauge a 100%, exibe `>1600%`. Tray mostra `!!!` acima de 100%.
- **Nunca restringir `minimum`/`maximum` em campos existentes do electron-store sem migration** — crasha o app no startup.
