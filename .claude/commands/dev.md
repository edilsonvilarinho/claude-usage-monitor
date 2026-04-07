# /dev — Unified Development Command

Comando único para qualquer tarefa de desenvolvimento. Você descreve o que quer — eu decido como executar da forma mais eficiente possível.

---

## Como usar

```
/dev <descrição da tarefa>
```

Exemplos:
- `/dev corrige o bug onde o countdown some ao trocar idioma`
- `/dev adiciona suporte a tema claro no popup`
- `/dev release minor`
- `/dev refatora o pollingService para expor nextPollAt`

---

## Decisão interna (transparente para você)

Ao receber o pedido, avalio automaticamente:

### 1. Tipo da tarefa

| Sinal no pedido | Tipo detectado |
|---|---|
| "corrige", "bug", "erro", "não funciona", "quebrado" | BUG FIX |
| "adiciona", "novo", "implementa", "cria", "exibe" | FEATURE |
| "refatora", "renomeia", "reorganiza", "simplifica" | REFACTOR |
| "release", "versão", "publica", "lança" | RELEASE |
| "analisa", "explica", "por que", "como funciona" | ANALYSIS |
| "verifica", "testa", "mostra", "lista", "quanto", "o que é" | ANALYSIS |

### 2. Complexidade

**SIMPLES** — Execução direta (sem subagentes, sem Plan Mode):
- Escopo está claro na descrição
- ≤ 3 arquivos envolvidos
- Sem decisões arquiteturais

**COMPLEXA** — Workflow estruturado (Plan Mode + issue + branch + PR):
- Escopo incerto ou amplo
- Muitos arquivos ou efeitos colaterais
- Decisões de design necessárias

> Antes de spawnar Explore agent, tente 2–3 buscas Glob/Grep diretas. Use Explore só se o escopo ainda não estiver claro.

---

## Caminhos de execução

### SIMPLES (BUG FIX, FEATURE ou REFACTOR)
```
1. Ler os arquivos relevantes diretamente
2. Aplicar a mudança
3. npm run build (confirmar exit 0)
4. git add + commit + push para master (automático)
```
Sem issue, sem branch, sem PR — a menos que você peça.

### COMPLEXA (BUG FIX, FEATURE ou REFACTOR)
```
1. Plan Mode (1 Explore agent se necessário)
2. Aguardar aprovação do plano
3. gh issue create
4. git checkout -b <tipo>/<slug>#<issue>
5. @implementer executa
6. npm run build (confirmar exit 0)
7. @tester (só se mudança for arriscada)
8. commit + PR
```

### REFACTOR
- **SIMPLES** se: renomeia, extrai função, move arquivo, sem mudança de contrato
- **COMPLEXA** se: reestrutura módulos, altera interfaces, afeta múltiplos serviços

### RELEASE
```
1. Perguntar tipo de bump se não informado (patch/minor/major)
2. Bump version no package.json
3. npm run dist
4. git tag + push
5. gh release create com changelog
```
Sem Plan Mode.

### ANALYSIS
```
Responder diretamente. Sem código, sem agents, sem Plan Mode.
```

---

## Regras de ouro

- **Padrão é SIMPLES** — só escalo para COMPLEXA se genuinamente necessário
- **Explore agents**: só 1, só quando o escopo é genuinamente incerto
- **@tester**: só para mudanças em lógica crítica (IPC, state, polling, credentials)
- **Plan Mode**: só para decisões arquiteturais, nunca para tarefas mecânicas
- Sempre informo qual caminho escolhi e por quê antes de executar

---

## Transparência

Antes de executar, confirmo em uma linha:
> `→ [SIMPLES FEATURE] implementando direto em 2 arquivos, commit para master`
> `→ [COMPLEXA FEATURE] abrindo plan mode — escopo envolve 5+ arquivos`
> `→ [RELEASE minor] 3.1.0 → 3.2.0, sem plan mode`

Se a escolha estiver errada, você corrige antes de eu começar.
