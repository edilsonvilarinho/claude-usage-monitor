# /otimizacao-token — Auditoria de Consumo de Tokens

Analisa os arquivos de configuração do Claude Code (agentes, comandos, memórias, CLAUDE.md) e identifica padrões que desperdiçam tokens desnecessariamente.

---

## O que este comando faz

1. **Verifica agentes** — detecta tool `Agent` habilitada e modelo `opus` sem justificativa
2. **Verifica comandos** — detecta contradições de regras, conteúdo duplicado e arquivos >80 linhas
3. **Verifica memória** — lê MEMORY.md + cada `*.md` do diretório: verbosidade, redundância, projetos concluídos, drift de versão vs `package.json`, campos de frontmatter desnecessários
4. **Verifica CLAUDE.md** — detecta crescimento além do necessário (>80 linhas)
5. **Estima tokens reais** — calcula `chars ÷ 4` de cada arquivo auto-loaded E de cada comando invocado nesta sessão
6. **Relata e pergunta** — lista problemas com impacto e pergunta quais corrigir

---

## Execução

Derive os paths dinamicamente a partir do projeto atual:
- `MEMORY_DIR` = `~/.claude/projects/<projeto-slug>/memory/` onde `<projeto-slug>` é derivado do working directory atual (barras → hífens, ex: `C--Users-Suporte-workspace-claude-usage-monitor`)
- `PROJECT_DIR` = working directory atual (`.claude/agents/`, `.claude/commands/`, `CLAUDE.md`, `package.json`)

Leia os seguintes arquivos **em paralelo** (pule silenciosamente se o diretório/arquivo não existir):

- `.claude/agents/*.md` — se diretório existir: tools habilitadas + campo `model:`
- `.claude/commands/*.md` — se diretório existir: contradições de regras + conceitos repetidos + contagem de linhas
- `CLAUDE.md` — tamanho e redundâncias
- `package.json` — campo `"version"` para comparar com memória de projeto
- `$MEMORY_DIR/MEMORY.md` — índice de memórias
- Cada `*.md` referenciado no MEMORY.md — verbosidade, drift de versão, campos extras no frontmatter

Após ler, execute:
1. Contar `chars` via `wc -c` de cada arquivo auto-loaded (CLAUDE.md + MEMORY.md + cada arquivo de memória) → `tokens ≈ chars ÷ 4`
2. Contar linhas dos arquivos `commands/*.md` — comandos >80 linhas têm custo alto quando invocados
3. Comparar versão em `project_*.md` com `"version"` em `package.json`
4. Buscar blocos de texto similares (>3 linhas idênticas ou quase idênticas) em 3+ arquivos de comandos
5. Verificar se arquivos de memória têm campos desnecessários no frontmatter (ex: `originSessionId`)

---

## Critérios de problema

| Problema | Impacto estimado | Como corrigir |
|---|---|---|
| Agente com tool `Agent` | +17k tokens por invocação | Remover `Agent` da lista de tools |
| Agente com `model: opus` sem justificativa | 3–5× custo por invocação | Trocar para `sonnet` se a tarefa não exige raciocínio avançado |
| Regra "Plan Mode sempre obrigatório" contradizendo roteamento SIMPLES/COMPLEXA | +5–15k tokens em tarefas simples | Refinar para "obrigatório apenas para COMPLEXA" |
| Conteúdo duplicado em 3+ arquivos de comandos | Carregado N vezes na sessão | Extrair para arquivo canônico; demais referenciam |
| Comando com >80 linhas | +tokens por invocação como skill | Condensar; remover exemplos redundantes |
| MEMORY.md com >8 entradas | +tokens de carregamento fixo | Auditar entradas obsoletas ou concluídas |
| Arquivo de memória com >30 linhas | +tokens por sessão | Condensar para ≤15 linhas mantendo regra + why + how |
| Memória com campos desnecessários no frontmatter (`originSessionId`, etc.) | ~50 chars por arquivo | Remover campos que não são `name`, `description`, `type` |
| Memória `user_*` redundante com system prompt já configurado | Pequeno mas evitável | Remover se comportamento já garantido por outra camada |
| Drift de versão: `project_*.md` diverge de `package.json` | Falsa informação em contexto | Atualizar versão na memória |
| Memória `project_*` com status "CONCLUÍDO"/"mergeado" | Lixo no índice | Deletar arquivo e remover entrada do MEMORY.md |
| CLAUDE.md com >80 linhas | +tokens fixos por sessão | Verificar se há conteúdo derivável do código |

---

## Referência

O histórico completo das otimizações já aplicadas neste projeto está em `.claude/token-optimization.md`. Consulte antes de sugerir mudanças para evitar retrabalho.

---

## Formato do relatório

```
## Auditoria de tokens — resultado

### Inventário de contexto auto-loaded
| Arquivo | Chars | Tokens estimados |
|---|---|---|
| CLAUDE.md | X chars | ~Xk |
| MEMORY.md (índice) | X chars | ~Xk |
| memory/<arquivo>.md | X chars | ~Xk |
| **Total fixo por sessão** | | **~Xk** |

### Custo por invocação de skills (quando chamados)
| Comando | Linhas | Tokens estimados |
|---|---|---|
| commands/dev.md | X linhas | ~Xk |
| commands/otimizacao-token.md | X linhas | ~Xk |

### Problemas encontrados
- [CRÍTICO] <arquivo>: <descrição> → impacto estimado: ~Xk tokens
- [MENOR] <arquivo>: <descrição> → impacto estimado: ~Xk tokens

### Sem problemas
- <arquivo>: OK

### Previsão de economia por cenário
| Cenário | Antes (estimado) | Depois (estimado) | Economia |
|---|---|---|---|
| Overhead fixo por sessão (CLAUDE.md + memória) | ~Xk | ~Xk | ~Xk |
| Sessão simples (/fix, /feat ≤3 arquivos) | ~Xk | ~Xk | ~Xk |
| Sessão complexa (implementer + tester) | ~Xk | ~Xk | ~Xk |

> Base de cálculo: chars ÷ 4 para arquivos; ~17k overhead fixo por subagente; ~3–5× custo por troca opus→sonnet.

### Estimativa de economia total se tudo corrigido
~Xk tokens por sessão típica

Quais problemas você quer corrigir?
```
