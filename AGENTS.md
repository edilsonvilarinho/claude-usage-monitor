# AGENTS.md

## Essential Commands

```bash
npm run dev      # tsc main.ts + electron (dev mode, system tray)
npm run build    # esbuild renderer (dist/main.js must exist first)
npm run dist     # NSIS + portable → dist-build/
npm test         # vitest (197 tests)
```

**Critical:** Always run `tsc -p tsconfig.main.json` before `electron-builder` — Linux CI fixed this.

**⚠️ IMPORTANTE — After release:** Always upload .exe files to GitHub Release:
```bash
gh release upload v10.x.x "dist-build/Claude Usage Monitor 10.x.x.exe" --clobber
gh release upload v10.x.x "dist-build/Claude Usage Monitor Setup 10.x.x.exe" --clobber
```

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

---

# Workflow de Implementação — Checkpoints Obrigatórios

## Fase 1: Análise (ANTES de qualquer código)

- [ ] Ler seções relevantes do `BUSINESS_RULES.md`
- [ ] Verificar se existe **dead code** relacionado (pastas/components nunca importados)
- [ ] Verificar se existe **duplicação** (HTML estático no index.html vs componente JS)
- [ ] Verificar se existem **planos anteriores** em `minimax-planos/` ou `claude-code-planos/`
- [ ] Criar/anotar plano em `minimax-planos/` com:
  - Status: "Em progresso" ou "Planejado"
  - Branch: nome da branch a ser criada
  - Issue: #numero (se aplicável)
  - Progresso: checklist com cada passo

## Fase 2: Implementação

- [ ] Criar branch: `git checkout -b tipo/nome-curto#issue`
- [ ] Para mudanças arriscadas (refactors, remoções): criar branch backup primeiro
  - `git branch backup/nome-antes-do-change`
- [ ] Implementar código
- [ ] **ATUALIZAR plano IMEDIATAMENTE** após cada passo concluído
- [ ] Não esperar — atualizar progresso proativamente sempre que completar algo

## Fase 3: Verificação

- [ ] `npm run build` — build limpo
- [ ] `npm test` — todos os testes passam
- [ ] Reiniciar `npm run dev` se houver mudança em `styles.css` (CSS pode não refletir sem restart)
- [ ] Para mudanças UI: solicitar screenshot ao usuário antes de merge
- [ ] Verificar que **NÃO QUEBROU** funcionalidade existente

## Fase 4: Commit e Push

- [ ] `git add . && git commit -m "tipo: descrição clara em português"`
- [ ] `git push -u origin nome-da-branch`
- [ ] Criar PR automaticamente (não esperar usuário pedir)
- [ ] Atualizar plano com PR# e avançar progresso
- [ ] **Solicitar confirmação do usuário antes de merge**

## Fase 5: Merge (após aprovação)

- [ ] `gh pr merge #XX --admin --squash`
- [ ] Deletar branch local: `git branch -d nome-da-branch`
- [ ] Atualizar plano para **Status: ✅ Concluído**
- [ ] `git checkout master && git pull`
- [ ] Commitar e pushar atualização do plano

## Fase 6: Consolidação (se aplicável)

- [ ] Se múltiplos planos afetam o mesmo arquivo, consolidar em um único PR
- [ ] Verificar se outro plano pendente modifica o mesmo arquivo antes de criar PR
- [ ] Comunicar ao usuário se houver conflito de planos

---

## Reiniciar Dev Server — Regra Importante

Após alteração em `styles.css`:
```bash
# Matar processo node/electron anterior
taskkill /F /IM node.exe  # Windows
# ou pkill -f electron # Linux

# Reiniciar
npm run build && npm run dev
```

CSS cache pode não atualizar sem restart completo.

---

## Screenshot para Mudanças UI

Para mudanças visuais:
1. Antes de implementar: pedir screenshot do estado atual
2. Após implementar: pedir screenshot do resultado
3. Comparar antes/depois antes de fazer merge

---

## Checklist Pré-Commit Rápida

```bash
# ANTES de commitar:
npm run build && npm test

# Se passar → commitar
# Se falhar → CORRIGIR ANTES
```

**NÃO commitar se build ou testes falharem.**

---

## Dead Code Checklist (análise de duplicação)

Ao criar novo plano que envolve UI/modais:
- [ ] Buscar em `index.html` se já existe elemento similar
- [ ] Buscar em `components/` se existe componente nunca usado
- [ ] Buscar em `app.ts` qual ID/seletor é usado realmente
- [ ] Verificar se `injectAllModals()` é chamada (se não for, componentes são dead code)
- [ ] Comparar IDs no código vs IDs no HTML estático

---

## Padrão de Nomenclatura

### Branches
```
tipo/nome-curto#numero-issue
Exemplos:
- fix/modal-botao-excluir#113
- chore/remove-dead-code
- feat/novo-modal-config
```

### Planos
```
minimax-planos/[tipo]-[nome-curto].md
Exemplos:
- minimax-planos/fix-header-icons-size.md
- minimax-planos/remove-dead-code-components.md
```

### Commits
```
tipo: descrição curta em português
Exemplos:
- fix: aumentar tamanho dos ícones do header
- chore: remover dead code components/modais
```

---

## Padrão de Progresso no Plano

```markdown
## Progresso

- [x] Analisar problema
- [x] Verificar dead code/duplicação
- [x] Criar/anotar plano
- [x] Criar branch
- [x] Implementar
- [x] Build + testes
- [x] Commit + push
- [ ] PR (aguardando confirmação)
- [ ] Merge
```

---

## Quando Sair do Plan Mode

Sair do Plan Mode quando:
- [ ] Usuário explicitamente pede para implementar
- [ ] Plano foi revisado e aprovado pelo usuário
- [ ] Checkpoints de análise foram completados
- [ ] Usuário pede para "fazer", "implementar", "executar"

---

## References

- Architecture: `CLAUDE.md`
- Business rules: `BUSINESS_RULES.md`
- Commands: `.claude/commands/*.md`
- Agents: `.claude/agents/*.md`