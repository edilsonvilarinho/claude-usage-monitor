# Token Optimization — Claude Code

Registro do processo de otimização de tokens aplicado neste projeto, com motivações detalhadas.
Objetivo: reduzir consumo de tokens por sessão sem perder qualidade de entrega.

---

## Contexto: por que tokens importam

O Claude Code tem um **limite de sessão** (context window). Cada operação consome tokens:
- Sistema carrega automaticamente: `CLAUDE.md` + `MEMORY.md` + system prompts (~10–15k tokens fixos por sessão)
- Cada ferramenta invocada adiciona ao contexto: leitura de arquivo, resultado de bash, output de agente
- Subagentes (Explore, Plan Mode, implementer, tester) têm **overhead fixo de ~17k tokens cada** — só pelo fato de existirem como subprocessos

Uma sessão mal configurada pode consumir 150k+ tokens para uma mudança de 3 arquivos que deveria custar 20k.

---

## O que foi alterado e por quê

### 1. Removido `Agent` do implementer

**Arquivo:** `.claude/agents/implementer.md`
**Antes:** `tools: Read, Edit, Write, Bash, Glob, Grep, Agent`
**Depois:** `tools: Read, Edit, Write, Bash, Glob, Grep`

**Por quê é um problema:**
O `Agent` tool permite que um agente spawne outros agentes. O implementer poderia criar um Explore agent por conta própria, gerando uma cadeia:

```
orchestrador → implementer → Explore agent
```

Isso significa 3 contextos de subprocesso em série. Cada nível paga o overhead fixo novamente. O Explore agent em particular lê muitos arquivos de uma vez — útil para mapear escopo, mas destrutivo para o budget de tokens quando o escopo já foi definido pelo orchestrador antes de chamar o implementer.

**Por que não perde qualidade:**
Quando o orchestrador delega para o implementer, o plano já foi aprovado. O implementer sabe exatamente o que fazer. Se precisar buscar um arquivo, ele usa `Glob` (encontra por padrão de nome) ou `Grep` (busca conteúdo). Essas ferramentas resolvem 99% das buscas necessárias durante implementação com custo muito menor que um Explore agent.

---

### 2. Corrigida contradição no `/workflow.md`

**Arquivo:** `.claude/commands/workflow.md`
**Antes:** `"Nunca pular o plan mode — toda mudança precisa de aprovação antes de código"`
**Depois:** `"Plan Mode: obrigatório apenas para mudanças COMPLEXAS. Fluxos SIMPLES (≤3 arquivos, escopo claro) vão direto para implementação"`

**Por quê é um problema:**
O `/dev`, `/feat` e `/fix` já tinham um sistema de roteamento SIMPLES/COMPLEXA bem pensado que permite pular Plan Mode em tarefas triviais. Mas o `/workflow.md` tinha uma regra global contradizendo isso.

O Claude lê todos os arquivos carregados no contexto e tenta reconciliar regras conflitantes. Quando há contradição, o comportamento é imprevisível — às vezes ele entra em Plan Mode desnecessariamente "por segurança". Isso custa:
- Tokens de entrar no Plan Mode
- Tokens de apresentar o plano
- Tokens de esperar aprovação
- Tokens de sair do Plan Mode

Para uma mudança de 1 arquivo, esse overhead pode ser maior que a implementação em si.

**Por que não perde qualidade:**
A classificação SIMPLES/COMPLEXA já garante que mudanças com risco real (escopo incerto, muitos arquivos, decisões arquiteturais) continuam usando Plan Mode. A regra foi refinada, não removida.

---

### 3. Adicionado critério de skip no auditor

**Arquivo:** `.claude/agents/auditor.md`
**Adicionado:** Seção "Quando pular esta auditoria"

**Por quê é um problema:**
O auditor é um subagente completo (modelo Sonnet, ferramentas de leitura e escrita). Invocá-lo ao final de toda sessão — mesmo uma sessão onde o único arquivo tocado foi 1 linha de CSS — paga ~17k tokens de overhead de subagente + tempo de leitura dos arquivos de memória.

A utilidade do auditor é real, mas condicional: ele importa quando há memórias novas criadas, issues fechados, ou PRs mergeados que geram conteúdo obsoleto. Para uma sessão de análise rápida, não há nada a auditar.

**Como funciona o critério adicionado:**
```
Pule se:
- Nenhum arquivo de memória foi criado/modificado na sessão
- Nenhum issue/PR foi criado
- MEMORY.md tem ≤8 entradas
```

**Por que não perde qualidade:**
O auditor só tem valor quando há algo para limpar. Sem novos arquivos de memória, sem projetos concluídos, sem duplicatas — a auditoria retorna "tudo OK" de qualquer forma. Pular nesses casos não degrada nada.

---

### 4. Adicionada orientação de Glob/Grep antes de Explore agent

**Arquivo:** `.claude/commands/dev.md`
**Adicionado:** `"Antes de spawnar Explore agent, tente 2–3 buscas Glob/Grep diretas"`

**Por quê é um problema:**
O Explore agent é poderoso mas caro. Ele faz múltiplas buscas em sequência, lê vários arquivos, e consolida tudo em um relatório. Para casos onde o escopo se resolve com uma busca por nome de arquivo (`Glob`) ou uma busca por string (`Grep`), spawnar um Explore é desperdício.

**Exemplo prático:**
Tarefa: "entenda como o pollingService calcula o intervalo"

- Caminho caro: spawna Explore → Explore lê 8 arquivos → retorna relatório → 40k tokens
- Caminho certo: `Grep "pollingInterval"` → encontra em 1 arquivo → lê aquele arquivo → 3k tokens

**Regra adicionada:** só spawnar Explore se após 2–3 buscas diretas o escopo ainda não estiver claro.

---

## Arquivos que foram analisados e mantidos sem alteração

| Arquivo | Motivo para não alterar |
|---|---|
| `CLAUDE.md` | Já compacto (62 linhas). Conteúdo é necessário e não derivável trivialmente do código |
| `.claude/agents/tester.md` | Já está enxuto: `Read, Bash, Glob, Grep` — sem `Agent`, sem redundâncias |
| `.claude/commands/feat.md` | Step 0 de roteamento SIMPLES/COMPLEXA correto. Complementa o `/dev` para flows explícitos |
| `.claude/commands/fix.md` | Mesmo caso do `/feat.md` |
| `.claude/commands/hotfix.md` | @tester obrigatório nesse fluxo é intencional — hotfix em produção justifica o custo extra de validação |
| `.claude/commands/release.md` | Workflow mecânico já sem Plan Mode, sem subagentes desnecessários |
| `memory/MEMORY.md` | 4 entradas — dentro do limite seguro (≤8) |

---

## Estimativa de impacto

| Cenário | Antes | Depois |
|---|---|---|
| Mudança simples via `/dev` | ~30–50k tokens | ~15–25k tokens |
| Feature complexa com implementer | ~80–120k tokens | ~50–70k tokens |
| Hotfix com implementer + tester | ~100k tokens | ~80k tokens (tester justificado) |
| Sessão de análise sem mudança | ~20k + 17k auditor | ~20k (auditor pulado) |

---

## Princípio geral aprendido

> **Cada subagente paga um overhead fixo de ~17k tokens**, independente do tamanho da tarefa. O sistema de roteamento SIMPLES/COMPLEXA existe para garantir que esse custo só seja pago quando o benefício supera o overhead.
>
> Contradições nas instruções são silenciosamente prejudiciais — o modelo tenta reconciliar regras conflitantes de forma conservadora, frequentemente escolhendo o caminho mais "seguro" (e mais caro).
>
> Ferramentas diretas (`Glob`, `Grep`, `Read`) custam uma fração do custo de um subagente para o mesmo resultado quando o escopo é conhecido.
