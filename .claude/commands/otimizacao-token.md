# /otimizacao-token — Auditoria de Consumo de Tokens

Analisa agentes, comandos, memórias e CLAUDE.md para identificar desperdício de tokens.

Modos:
- `/otimizacao-token` — auditoria + relatório + pergunta o que corrigir
- `/otimizacao-token --fix` — auditoria + aplica correções de baixo risco automaticamente + commit

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

## Modo padrão (sem `--fix`)
Produza tabelas de:
1. **Inventário auto-loaded**: arquivo | chars | tokens estimados | total fixo por sessão
2. **Custo por skill**: comando | linhas | tokens estimados
3. **Problemas encontrados**: severidade | arquivo | descrição | impacto estimado
4. **Previsão de economia**: cenário | antes | depois | economia

Finalize perguntando quais problemas o usuário quer corrigir.

---

## Modo `--fix` — correções automáticas de baixo risco

Execute após a auditoria, sem pedir confirmação entre cada item:
**Correções elegíveis (baixo risco — sem aprovação):**
1. **Frontmatter extra** — remover campos além de `name`, `description`, `type` de arquivos de memória
2. **Drift de versão** — atualizar versão em `project_*.md` para bater com `package.json`
3. **CLAUDE.md >60 linhas** — remover seções cujo conteúdo é derivável direto do código (Renderer, Build pipeline detalhado, serviços triviais). Preservar: comandos de build/test, arquitetura não-óbvia, key notes críticos
4. **Memória verbosa (>30 linhas)** — condensar corpo para ≤15 linhas mantendo `name`, `description`, `type` e o núcleo da regra/fato
**Correções que exigem confirmação explícita (alto risco):**
- Deletar arquivo de memória `project_*` (perda de histórico)
- Remover tool `Agent` de agentes (pode quebrar fluxo)
- Alterar `model:` de agentes
- Condensar commands (pode alterar comportamento)
**Fluxo de execução no modo `--fix`:**
1. Auditar (igual ao modo padrão)
2. Aplicar todas as correções de baixo risco em sequência
3. Atualizar `MEMORY.md` se algum arquivo de memória foi alterado
4. `git add` nos arquivos modificados dentro de `PROJECT_DIR` (CLAUDE.md, .claude/*)
5. Commit: `chore: otimização de tokens — <resumo das correções aplicadas>`
6. Push
7. Apresentar tabela final: o que foi corrigido | tokens economizados estimados
8. Listar correções de alto risco pendentes e perguntar se aplica
