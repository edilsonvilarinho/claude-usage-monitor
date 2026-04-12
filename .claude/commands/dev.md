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

## Caminhos de execução

**SIMPLES (BUG FIX / FEATURE / REFACTOR)**
1. Ler arquivos relevantes
2. Aplicar mudança
3. `npm run build` (confirmar exit 0)
4. `git add + commit + push` para master — sem issue, sem branch, sem PR

**COMPLEXA (BUG FIX / FEATURE / REFACTOR)**
1. Plan Mode (1 Explore agent se necessário) → aguardar aprovação
2. `gh issue create`
3. `git checkout -b <tipo>/<slug>#<issue>`
4. @implementer executa
5. `npm run build` (confirmar exit 0)
6. @tester (só se lógica crítica: IPC, state, polling, credentials)
7. commit + PR

**REFACTOR**: SIMPLES se renomeia/extrai/move sem mudar contratos. COMPLEXA se reestrutura módulos ou altera interfaces.

**RELEASE**: bump version → `npm run dist` → tag → push → `gh release create`. Sem Plan Mode.

**ANALYSIS**: avisar que não precisava do `/dev`, responder diretamente sem código, agents ou Plan Mode.

---

## Regras

- Padrão é SIMPLES — só escala para COMPLEXA se genuinamente necessário
- @tester: só para lógica crítica (IPC, state, polling, credentials)
- Plan Mode: só para decisões arquiteturais, nunca para tarefas mecânicas

## Transparência

Confirmo em uma linha antes de executar:
> `→ [SIMPLES BUG FIX] lendo 2 arquivos, commit para master`
> `→ [COMPLEXA FEATURE] abrindo plan mode — escopo envolve 5+ arquivos`
> `→ [RELEASE minor] 3.1.0 → 3.2.0, sem plan mode`

Se a classificação estiver errada, corrija antes de eu começar.
