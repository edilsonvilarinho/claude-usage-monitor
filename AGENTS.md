# AGENTS.md

## Essential Commands

```bash
npm run dev      # tsc main.ts + electron (dev mode, system tray)
npm run build    # esbuild renderer (dist/main.js must exist first)
npm run dist     # NSIS + portable → dist-build/
npm test         # vitest (197 tests)
```

**Critical:** Always run `tsc -p tsconfig.main.json` before `electron-builder` — Linux CI fixed this.

## Testing

- Run single test: `vitest run src/services/__tests__/pollingService.test.ts`
- Coverage: `npm run test:coverage` → `coverage/`

## Monorepo

```
├── shared/      # shared package (npm run shared:build)
├── server/      # cloud sync server (npm run server:build)
└── src/         # main Electron app
```

Entry points: `src/main.ts` (main), `src/preload.ts` (bridge), `src/renderer/` (UI)

## Workflows & Commands

All workflows are defined in `.claude/`:

| Command | Purpose |
|---------|---------|
| `/dev` | Unified — classifies and routes automatically |
| `/release` | bump → build → tag → GitHub Release |
| `/feat` | New feature (issue → branch → PR) |
| `/fix` | Bug fix (issue → branch → PR) |
| `/hotfix` | Critical production bug (direct to master) |
| `/test` | Test coverage (plan → issue → tester → PR) |
| `/otimizacao-token` | Token audit + optional auto-fix |

## Agents

| Agent | Role |
|-------|------|
| `@implementer` | Write/modify code (in `.claude/agents/implementer.md`) |
| `@tester` | QA, tests, coverage (in `.claude/agents/tester.md`) |
| `@auditor` | Cleanup memory/context (in `.claude/agents/auditor.md`) |

## Key Constraints

- **Português (BR)** — respond user in pt-br, commits in pt-br
- **electron-store schema** — never tighten `minimum`/`maximum` without migration
- **Rate limit persists** — `rateLimitedUntil` survives app restart
- **utilization can exceed 1.0** — UI caps at 100%, displays ">1600%"

## Mandatory Workflow

**Antes de qualquer alteração de código** (bug fix, feature, refactor):
1. Ler seções relevantes do `BUSINESS_RULES.md`
2. Verificar se a mudança não viola regras existentes

**Após qualquer alteração de código**:
- Se adicionou nova lógica, threshold, intervalo ou comportamento → atualizar `BUSINESS_RULES.md`
- Se removeu/substituiu regra existente → atualizar `BUSINESS_RULES.md`
- Atualização vai no **mesmo commit** da mudança de código

## References

- Architecture: `CLAUDE.md`
- Business rules: `BUSINESS_RULES.md`
- Commands: `.claude/commands/*.md`
- Agents: `.claude/agents/*.md`