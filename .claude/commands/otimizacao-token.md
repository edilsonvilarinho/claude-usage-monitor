# /otimizacao-token — Auditoria de Consumo de Tokens

Analisa agentes, comandos, memórias e CLAUDE.md para identificar desperdício de tokens.

Modos: `/otimizacao-token` (auditoria + relatório) | `/otimizacao-token --fix` (aplica correções baixo risco + commit)

## Execução

Paths: `MEMORY_DIR=~/.claude/projects/<slug>/memory/` | `PROJECT_DIR=cwd`

Leia em paralelo: `.claude/agents/*.md` (tools + model) | `.claude/commands/*.md` (linhas) | `CLAUDE.md` (tamanho) | `package.json` (version) | `$MEMORY_DIR/*.md` (verbosidade, drift, frontmatter)

Métricas: `wc -c` → tokens ≈ chars ÷ 4 | `wc -l` por command | comparar versão `project_*.md` vs `package.json`

## Critérios de problema

| Problema | Impacto | Correção |
|---|---|---|
| Agente com tool `Agent` | +17k tokens/invocação | Remover `Agent` |
| Agente com `model: opus` sem justificativa | 3–5× custo | Trocar para `sonnet` |
| Command >80 linhas | +tokens/invocação | Condensar |
| MEMORY.md >8 entradas | +tokens fixo | Auditar entradas |
| Memória >30 linhas | +tokens/sessão | Condensar p/ ≤15 linhas |
| Frontmatter com campos extras | ~50 chars/arquivo | Manter só `name`, `description`, `type` |
| Drift de versão `project_*.md` ≠ `package.json` | Dado falso | Atualizar versão |
| `project_*` com "CONCLUÍDO/mergeado" | Lixo no índice | Deletar + remover MEMORY.md |
| CLAUDE.md >80 linhas | +tokens fixo/sessão | Remover seções deriváveis do código |

## Modo padrão

Produzir 4 tabelas: (1) inventário auto-loaded (arquivo | chars | tokens), (2) custo por skill (command | linhas | tokens), (3) problemas (severidade | arquivo | descrição | impacto), (4) previsão de economia. Finalizar perguntando quais corrigir.

## Modo `--fix`

**Baixo risco (sem aprovação):** frontmatter extra | drift de versão | CLAUDE.md >60 linhas (remover derivável) | memória >30 linhas (condensar p/ ≤15)

**Alto risco (pedir confirmação):** deletar `project_*` | remover tool `Agent` | alterar `model:` | condensar commands

**Fluxo:** auditar → aplicar baixo risco → atualizar MEMORY.md → `git add` (CLAUDE.md, .claude/*) → commit `chore: otimização de tokens — <resumo>` → push → tabela final → listar pendentes de alto risco
