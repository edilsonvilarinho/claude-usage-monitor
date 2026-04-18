# /dev — Unified Development Command

> Use `/dev` apenas para execução de código. Análises/explicações — pergunte diretamente sem o `/dev`.

## Tipo da tarefa

| Sinal | Tipo |
|---|---|
| "corrige", "bug", "erro", "quebrado" | BUG FIX |
| "adiciona", "novo", "implementa", "cria", "exibe" | FEATURE |
| "refatora", "renomeia", "reorganiza", "simplifica" | REFACTOR |
| "release", "versão", "publica", "lança" | RELEASE |

**SIMPLES** — escopo claro, ≤3 arquivos, sem decisões arquiteturais → execução direta.
**COMPLEXA** — escopo incerto, muitos arquivos, decisões de design → Plan Mode + issue + branch + PR.

> Tente 2–3 Glob/Grep antes de spawnar Explore agent.

## BUSINESS_RULES.md (obrigatório)

- **Antes** de qualquer mudança de código: ler seções relevantes; verificar que a mudança não viola regras existentes
- **Após** qualquer mudança: atualizar se adicionou/removeu lógica, threshold, intervalo ou comportamento
- A atualização vai no **mesmo commit** — nunca separado

## Caminhos de execução

**SIMPLES (BUG FIX / FEATURE / REFACTOR)**
1. Ler `BUSINESS_RULES.md` (seções relevantes)
2. Ler arquivos relevantes → aplicar mudança
3. `npm run build` (exit 0) → `git add + commit + push` para master

**COMPLEXA (BUG FIX / FEATURE / REFACTOR)**
1. Ler `BUSINESS_RULES.md` → Plan Mode (1 Explore se necessário) → aguardar aprovação
2. `gh issue create` → `git checkout -b <tipo>/<slug>#<issue>`
3. @implementer executa → `npm run build` (exit 0)
4. @tester (só se: IPC, state, polling, credentials) → commit + PR

**REFACTOR**: SIMPLES se renomeia/extrai/move sem mudar contratos. COMPLEXA se reestrutura módulos.
**RELEASE**: bump version → `npm run dist` → tag → push → `gh release create`. Sem Plan Mode.
**ANALYSIS**: avisar que não precisava do `/dev`, responder diretamente.

## Regras

- **BUSINESS_RULES.md é lei** — nenhuma mudança viola regras sem atualizar o documento
- Padrão é SIMPLES — só escala para COMPLEXA se genuinamente necessário
- @tester: só para lógica crítica (IPC, state, polling, credentials)
- Plan Mode: só para decisões arquiteturais, nunca para tarefas mecânicas

## Transparência

Confirmo em uma linha antes de executar:
> `→ [SIMPLES BUG FIX] lendo 2 arquivos, commit para master`
> `→ [COMPLEXA FEATURE] abrindo plan mode — escopo envolve 5+ arquivos`

Se a classificação estiver errada, corrija antes de eu começar.
