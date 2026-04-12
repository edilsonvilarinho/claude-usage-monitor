# /dev — Unified Development Command

> Use `/dev` apenas para execução de código. Análises e explicações — pergunte diretamente sem o `/dev` (~1k tokens economizados).

Classifica automaticamente o tipo e complexidade, então executa.

---

## Tipo da tarefa

| Sinal | Tipo |
|---|---|
| "corrige", "bug", "erro", "quebrado" | BUG FIX |
| "adiciona", "novo", "implementa", "cria", "exibe" | FEATURE |
| "refatora", "renomeia", "reorganiza", "simplifica" | REFACTOR |
| "release", "versão", "publica", "lança" | RELEASE |
| "analisa", "explica", "por que", "como funciona", "verifica", "lista" | ANALYSIS |

## Complexidade

**SIMPLES** — escopo claro, ≤3 arquivos, sem decisões arquiteturais → execução direta.
**COMPLEXA** — escopo incerto, muitos arquivos, decisões de design → Plan Mode + issue + branch + PR.

> Tente 2–3 Glob/Grep antes de spawnar Explore agent. Use Explore só se escopo genuinamente incerto.

---

## Passo obrigatório — BUSINESS_RULES.md

**Antes de qualquer alteração de código** (bug fix, feature, refactor), ler as seções relevantes do `BUSINESS_RULES.md` e verificar:
- A mudança não viola nenhuma regra de negócio documentada
- Se alterar polling, credenciais, smart scheduler, sync ou persistência: ler o módulo correspondente integralmente
- Se a mudança exigir atualizar uma regra, atualizar o `BUSINESS_RULES.md` no mesmo commit

> Não pule este passo mesmo em mudanças "triviais" — regressões de lógica geralmente ocorrem em alterações que parecem seguras.

---

## Caminhos de execução

**SIMPLES (BUG FIX / FEATURE / REFACTOR)**
1. Ler seções relevantes do `BUSINESS_RULES.md`
2. Ler arquivos relevantes do código
3. Aplicar mudança
4. `npm run build` (confirmar exit 0)
5. `git add + commit + push` para master — sem issue, sem branch, sem PR

**COMPLEXA (BUG FIX / FEATURE / REFACTOR)**
1. Ler seções relevantes do `BUSINESS_RULES.md`
2. Plan Mode (1 Explore agent se necessário) → aguardar aprovação
3. `gh issue create`
4. `git checkout -b <tipo>/<slug>#<issue>`
5. @implementer executa
6. `npm run build` (confirmar exit 0)
7. @tester (só se lógica crítica: IPC, state, polling, credentials)
8. commit + PR

**REFACTOR**: SIMPLES se renomeia/extrai/move sem mudar contratos. COMPLEXA se reestrutura módulos ou altera interfaces.

**RELEASE**: bump version → `npm run dist` → tag → push → `gh release create`. Sem Plan Mode.

**ANALYSIS**: avisar que não precisava do `/dev`, responder diretamente sem código, agents ou Plan Mode.

---

## Regras

- **BUSINESS_RULES.md é lei** — nenhuma mudança pode violar as regras documentadas sem atualizar o documento primeiro
- Padrão é SIMPLES — só escala para COMPLEXA se genuinamente necessário
- @tester: só para lógica crítica (IPC, state, polling, credentials)
- Plan Mode: só para decisões arquiteturais, nunca para tarefas mecânicas

## Transparência

Confirmo em uma linha antes de executar:
> `→ [SIMPLES BUG FIX] lendo 2 arquivos, commit para master`
> `→ [COMPLEXA FEATURE] abrindo plan mode — escopo envolve 5+ arquivos`
> `→ [RELEASE minor] 3.1.0 → 3.2.0, sem plan mode`

Se a classificação estiver errada, corrija antes de eu começar.
