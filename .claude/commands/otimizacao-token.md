# /otimizacao-token — Auditoria de Consumo de Tokens

Analisa os arquivos de configuração do Claude Code (agentes, comandos, memórias, CLAUDE.md) e identifica padrões que desperdiçam tokens desnecessariamente.

---

## O que este comando faz

1. **Verifica agentes** — detecta se algum agente tem a tool `Agent` habilitada (cada subagente paga ~17k tokens de overhead fixo)
2. **Verifica comandos** — detecta contradições entre arquivos que forçam comportamentos conservadores desnecessários (ex.: Plan Mode obrigatório para tarefas simples)
3. **Verifica memória** — lê MEMORY.md (índice) + cada arquivo `*.md` do diretório de memória: conta entradas, detecta verbosidade (>30 linhas), redundância com system prompt, versões desatualizadas, projetos concluídos
4. **Verifica CLAUDE.md** — detecta se cresceu além do necessário (>80 linhas é sinal de alerta)
5. **Relata e pergunta** — lista problemas encontrados com estimativa de impacto e pergunta ao usuário quais quer corrigir

---

## Execução

Leia os seguintes arquivos em paralelo:

- `.claude/agents/*.md` — verificar tools habilitadas
- `.claude/commands/*.md` — verificar contradições de regras
- `CLAUDE.md` — verificar tamanho e redundâncias
- `C:\Users\edils\.claude\projects\C--Users-edils-workspace-claude-usage\memory\MEMORY.md` — verificar índice
- Arquivos `*.md` no diretório de memória — verificar verbosidade

---

## Critérios de problema

| Problema | Impacto estimado | Como corrigir |
|---|---|---|
| Agente com tool `Agent` | +17k tokens por invocação | Remover `Agent` da lista de tools |
| Regra "Plan Mode sempre obrigatório" contradizendo roteamento SIMPLES/COMPLEXA | +5–15k tokens em tarefas simples | Refinar para "obrigatório apenas para COMPLEXA" |
| MEMORY.md com >8 entradas | +tokens de carregamento fixo | Auditar entradas obsoletas ou concluídas |
| Arquivo de memória com >30 linhas | +tokens por sessão | Condensar para ≤15 linhas mantendo regra + why + how |
| Memória `user_*` redundante com system prompt já configurado | Pequeno mas evitável | Remover se o comportamento já está garantido por outra camada |
| Memória `project_*` com versão hardcoded desatualizada | Falsa informação | Atualizar versão ou remover campo |
| Memória `project_*` com status "CONCLUÍDO"/"mergeado" | Lixo no índice | Deletar arquivo e remover entrada do MEMORY.md |
| CLAUDE.md com >80 linhas | +tokens fixos por sessão | Verificar se há conteúdo derivável do código |
| Comando com exemplos excessivos ou documentação redundante | Tokens menores mas acumulam | Condensar seções de exemplos |

---

## Referência

O histórico completo das otimizações já aplicadas neste projeto está em `.claude/token-optimization.md`. Consulte antes de sugerir mudanças para evitar retrabalho.

---

## Formato do relatório

```
## Auditoria de tokens — resultado

### Problemas encontrados
- [CRÍTICO] <arquivo>: <descrição> → impacto estimado: ~Xk tokens
- [MENOR] <arquivo>: <descrição> → impacto estimado: ~Xk tokens

### Sem problemas
- <arquivo>: OK

### Estimativa de economia total se tudo corrigido
~Xk tokens por sessão típica

Quais problemas você quer corrigir?
```
