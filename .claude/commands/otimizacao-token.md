# /otimizacao-token — Auditoria de Consumo de Tokens

Analisa agentes, comandos, memórias e CLAUDE.md para identificar desperdício de tokens.

Modos: `/otimizacao-token` (auditoria + relatório) | `/otimizacao-token --fix` (aplica correções baixo risco + commit)

## Execução

Paths: `MEMORY_DIR=~/.claude/projects/<slug>/memory/` | `PROJECT_DIR=cwd`

Leia em paralelo: `.claude/agents/*.md` (tools + model) | `.claude/commands/*.md` (linhas) | `CLAUDE.md` (tamanho + conteúdo) | `package.json` (version) | `$MEMORY_DIR/*.md` (verbosidade, drift, frontmatter)

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
| CLAUDE.md >60 linhas | +tokens fixo/sessão | Ver análise por seção abaixo |

## Análise de seções do CLAUDE.md

Para cada seção do CLAUDE.md, classificar como **derivável** ou **não derivável** do código:

**Manter (não derivável):**
- Regras de idioma e convenções de commit
- Comandos npm/build (atalhos operacionais)
- Release checklist com valores concretos (tamanhos de artefato, paths)
- Regras arquiteturais proibidas (o que NÃO fazer) — não está no código
- Avisos de armadilha não óbvia (ex: migration de schema que crasha o app)

**Remover ou condensar (derivável do código):**
- Tabelas de serviços com comportamentos detalhados (timeouts, retries, debounce) — grep no código revela
- Prosa que repete o que um diagrama já mostra na mesma seção
- Itens de "Key notes" sobre detalhes de implementação interna (constantes, nomes de IPC, bibliotecas específicas)
- Qualquer seção cuja exclusão não mudaria como o Claude abordaria uma tarefa nova

**Formato da análise:** Para CLAUDE.md com >60 linhas, produzir tabela extra:

| Seção | Linhas | Derivável? | Sugestão |
|-------|--------|------------|----------|
| Services | 9 | Sim — detalhes no código | Substituir por 1 linha descritiva |
| Key notes item X | 1 | Sim — pertence a comentário no código | Remover |
| Architecture prosa | 3 | Sim — diagrama já mostra | Manter só diagrama |
| Clean Architecture | 12 | Não — regras proibidas | Manter |

## Modo padrão

Produzir 6 tabelas: (1) inventário auto-loaded (arquivo | chars | tokens), (2) custo por skill (command | linhas | tokens), (3) problemas (severidade | arquivo | descrição | impacto), (4) análise de seções do CLAUDE.md se >60 linhas, (5) previsão de economia total, (6) impacto na janela de contexto.

**Tabela 6 — Impacto na janela de contexto (200k tokens):**

| Métrica | Antes | Depois | Δ |
|---------|-------|--------|---|
| Tokens auto-loaded (seus arquivos) | X | Y | −Z |
| % da janela de contexto | X% | Y% | −Z% |
| Overhead fixo estimado total¹ | ~5–10k tokens | — | — |

¹ Inclui system prompt do harness, skills disponíveis e lembretes de sistema — não alterados por esta auditoria.

Calcular: `% = tokens_auto_loaded / 200.000 × 100`. Mostrar antes (estado atual) e depois (após aplicar todas as correções previstas).

## Modo `--fix`

**Baixo risco (sem aprovação):** frontmatter extra | drift de versão | memória >30 linhas (condensar p/ ≤15) | seções CLAUDE.md classificadas como deriváveis

**Alto risco (pedir confirmação):** deletar `project_*` | remover tool `Agent` | alterar `model:` | condensar commands

**Fluxo:** auditar → aplicar baixo risco → atualizar MEMORY.md → `git add` (CLAUDE.md, .claude/*) → commit `chore: otimização de tokens — <resumo>` → push → tabela final (incluindo tabela 6 com impacto antes/depois na janela de contexto) → listar pendentes de alto risco
