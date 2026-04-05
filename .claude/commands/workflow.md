# /workflow — Development Workflow Overview

Visão geral dos workflows disponíveis no projeto **Claude Usage Monitor** e quando usar cada um.

---

## Mapa de workflows

```
Nova funcionalidade       → /feat
Correção de bug           → /fix
Bug crítico em produção   → /hotfix  → após merge: /release patch
Cobertura de testes       → /test
Nova versão               → /release [patch|minor|major]
```

---

## Fluxo padrão de desenvolvimento

```
1. Identificar o tipo de trabalho
2. Executar o workflow correspondente (/feat, /fix, /hotfix, /test)
3. Workflow delega implementação ao @implementer
4. Workflow delega validação ao @tester
5. Commit + PR criado automaticamente pelo workflow
6. Após merge: executar /release se for feat ou fix acumulado
```

---

## Quando usar cada workflow

### /feat — Nova funcionalidade
Use quando adicionar algo novo ao app: nova configuração, novo comportamento do tray, nova métrica exibida, etc.

Etapas: plan → issue → branch `feat/<slug>#<n>` → @implementer → @tester → commit → PR

### /fix — Correção de bug
Use quando corrigir comportamento incorreto que não é crítico (não quebra produção ativamente).

Etapas: plan → issue → branch `fix/<slug>#<n>` → @implementer → @tester → commit → PR

### /hotfix — Correção crítica
Use quando o app está quebrado em produção: crash no startup, credencial não carrega, tray não aparece, etc.

Etapas: plan → issue → branch `hotfix/<slug>#<n>` → @implementer → @tester → commit → PR → `/release patch`

### /test — Cobertura de testes
Use quando quiser adicionar testes a uma área específica sem alterar comportamento.

Etapas: plan → issue → branch `test/<slug>#<n>` → @tester (+ @implementer se precisar escrever código) → commit → PR

### /release — Publicar versão
Use após um conjunto de PRs mergeados para publicar uma nova versão executável.

```
/release patch   # bugs corrigidos (1.3.0 → 1.3.1)
/release minor   # novas funcionalidades (1.3.0 → 1.4.0)
/release major   # mudanças quebram compatibilidade (1.3.0 → 2.0.0)
```

O workflow faz: bump version → commit → `npm run dist` → tag → push → GitHub Release com os `.exe`.

---

## Regras transversais

- **Nunca commitar** sem aprovação explícita do usuário
- **Plan Mode**: obrigatório apenas para mudanças COMPLEXAS (escopo incerto, 4+ arquivos, decisões arquiteturais). Fluxos SIMPLES (≤3 arquivos, escopo claro) vão direto para implementação — ver critério SIMPLES/COMPLEXA no `/dev`
- **`npm run build`** deve sair limpo antes de qualquer commit
- Branches seguem o padrão: `<tipo>/<slug>#<issue>`
- Commit messages: `<tipo>: <descrição> (closes #<issue>)`

---

## Agentes disponíveis

| Agente | Papel |
|--------|-------|
| `@implementer` | Escreve e modifica código, roda build |
| `@tester` | Analisa cobertura, escreve testes, produz checklists |
| `@auditor` | Limpa memórias obsoletas ao final de cada atividade |
