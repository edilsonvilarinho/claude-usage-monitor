# /otimizacao-token — Auditoria de Consumo de Tokens

Analisa agentes, comandos, memórias e CLAUDE.md para identificar desperdício de tokens.

---

## Execução

Derive os paths dinamicamente:
- `MEMORY_DIR` = `~/.claude/projects/<projeto-slug>/memory/` (barras → hífens no slug)
- `PROJECT_DIR` = working directory atual

Leia **em paralelo**:
- `.claude/agents/*.md` — tools habilitadas + campo `model:`
- `.claude/commands/*.md` — contradições de regras + linhas
- `CLAUDE.md` — tamanho
- `package.json` — campo `"version"`
- `$MEMORY_DIR/MEMORY.md` + cada `*.md` referenciado — verbosidade, drift de versão, frontmatter

Depois:
1. `wc -c` em cada arquivo auto-loaded → `tokens ≈ chars ÷ 4`
2. `wc -l` em cada command — >80 linhas tem custo elevado por invocação
3. Comparar versão em `project_*.md` com `package.json`
4. Verificar campos desnecessários no frontmatter (só `name`, `description`, `type` são válidos)

---

## Critérios de problema

| Problema | Impacto | Como corrigir |
|---|---|---|
| Agente com tool `Agent` | +17k tokens/invocação | Remover `Agent` da lista de tools |
| Agente com `model: opus` sem justificativa | 3–5× custo | Trocar para `sonnet` |
| Command com >80 linhas | +tokens/invocação | Condensar; remover exemplos redundantes |
| MEMORY.md com >8 entradas | +tokens fixo | Auditar entradas obsoletas |
| Arquivo de memória com >30 linhas | +tokens/sessão | Condensar para ≤15 linhas |
| Frontmatter com campos extras (`originSessionId`, etc.) | ~50 chars/arquivo | Remover campos além de `name`, `description`, `type` |
| Drift de versão: `project_*.md` ≠ `package.json` | Informação falsa | Atualizar versão na memória |
| Memória `project_*` com status "CONCLUÍDO"/"mergeado" | Lixo no índice | Deletar arquivo e remover do MEMORY.md |
| CLAUDE.md com >80 linhas | +tokens fixo/sessão | Verificar conteúdo derivável do código |

---

## Relatório

Produza tabelas de:
1. **Inventário auto-loaded**: arquivo | chars | tokens estimados | total fixo por sessão
2. **Custo por skill**: comando | linhas | tokens estimados
3. **Problemas encontrados**: severidade | arquivo | descrição | impacto estimado
4. **Previsão de economia**: cenário | antes | depois | economia

Finalize perguntando quais problemas o usuário quer corrigir.
