# /workflow — Development Workflow Overview

Visão geral dos workflows do projeto **Claude Usage Monitor**.

---

## Mapa de workflows

```
Nova funcionalidade       → /feat
Correção de bug           → /fix
Bug crítico em produção   → /hotfix  → após merge: /release patch
Cobertura de testes       → /test
Nova versão               → /release [patch|minor|major]
Qualquer coisa            → /dev (roteia automaticamente)
```

---

## Quando usar cada workflow

| Workflow | Usar quando |
|---|---|
| `/feat` | Adicionar algo novo: config, behavior do tray, nova métrica |
| `/fix` | Corrigir comportamento incorreto (não crítico) |
| `/hotfix` | App quebrado em produção: crash, credencial falha, tray some |
| `/test` | Adicionar testes sem alterar comportamento |
| `/release` | Publicar versão após PRs mergeados |
| `/dev` | Qualquer tarefa — classifica e roteia automaticamente |

**Branches**: `<tipo>/<slug>#<issue>` — **Commits**: `<tipo>: <descrição> (closes #<issue>)`

---

## Fluxo padrão

```
1. /dev (ou workflow específico)
2. Plan Mode apenas se COMPLEXA (escopo incerto, 4+ arquivos, decisões arquiteturais)
3. @implementer escreve código → npm run build → OK
4. @tester valida (só para lógica crítica: IPC, state, polling, credentials)
5. Commit + PR
6. Após merge em feat/fix: /release para publicar
```

---

## Agentes

| Agente | Papel |
|---|---|
| `@implementer` | Escreve e modifica código, roda build |
| `@tester` | Analisa cobertura, escreve testes, produz checklists |
| `@auditor` | Limpa memórias obsoletas ao final de cada atividade |
