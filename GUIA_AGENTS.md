# Guia: Como Usar Agents e Skills

## O que são Agents?

Agents são "papeis" especializados que eu posso assumir. Cada um tem responsabilidades específicas:

| Agent | Quando Usar | Como Ativar |
|-------|-------------|------------|
| `@implementer` | Quando precisa escrever/modificar código | Mencione ao pedir implementação |
| `@tester` | Quando precisa de testes ou validação | Mencione ao pedir testes |
| `@auditor` | Ao final da sessão para limpar contexto | Pergunte "faz auditoria" |
| `@planner` | Quando quer planejar antes de implementar | Mencione "cria um plano" |
| `@releaser` | Quando vai fazer release do app | Mencione "fazer release" |

---

## O que são Skills?

Skills são gatilhos automáticos. Quando você edita um arquivo que combina com o "trigger", eu automaticamente ativo as instruções do skill:

| Skill | Trigger (automático) | O que faz |
|-------|---------------------|-----------|
| `css-workflow` | Arquivos `.css` | Lembra de reiniciar dev server |
| `plan-workflow` | Arquivos em `minimax-planos/` | Aplica template de plano |
| `test-workflow` | Arquivos `*.test.ts` | Lembra de coverage e screenshot |

---

## Como Usar na Prática

### Agents — Como Ativar

**1. Quando quiser implementar algo:**
```
"@implementer: aumenta o tamanho dos ícones do header"
```

**2. Quando quiser criar um plano:**
```
"@planner: cria um plano para aumentar os ícones do header"
```

**3. Quando quiser testes:**
```
"@tester: escreve testes para a função de login"
```

**4. Quando quiser fazer release:**
```
"@releaser: faz release da versão 16.1.0"
```

**5. Quando quiser uma auditoria:**
```
"faz uma auditoria do contexto"
```

### Skills — Funcionam AUTOMATICAMENTE

- Editar `.css` → eu ativo `css-workflow`
- Editar `minimax-planos/*.md` → eu ativo `plan-workflow`
- Editar `*.test.ts` → eu ativo `test-workflow`

---

## Checklist de Uso por Tarefa

| Tarefa | Agent/Skill | Checkpoints |
|--------|-------------|-------------|
| Bug fix | `@implementer` | 1. Analisar 2. Plano 3. Implementar 4. Testar 5. PR |
| Nova feature | `@planner` → `@implementer` | 1. Planejar 2. Aprovar 3. Implementar |
| Testes | `@tester` | 1. Coverage 2. Screenshot 3. Manual checklist |
| Release | `@releaser` | 1. Build 2. Tag 3. GitHub Release 4. Upload .exe |
| Cleanup | `@auditor` | 1. MEMORY.md 2. Dead code 3. Consolidar |

---

## Workflow de Implementação (6 Fases)

Para qualquer tarefa de código:

1. **Análise** — Ler BUSINESS_RULES.md, verificar dead code, duplicação
2. **Plano** — Criar plano em `minimax-planos/` com checkpoint list
3. **Implementar** — Criar branch, fazer código, atualizar plano
4. **Verificar** — `npm run build && npm test`, screenshot (UI)
5. **Commit/PR** — push, criar PR, pedir confirmação
6. **Merge** — após aprovação, deletar branch, atualizar plano

---

## Regras Importantes

1. **Plano primeiro** — antes de implementar, sempre crio/verifico o plano
2. **Screenshot para UI** — mudanças visuais precisam de aprovação visual
3. **Testes passando** — nunca commitar se `npm test` falhar
4. **Dev server** — reiniciar após mudanças CSS
5. **Backup** — para refactors grandes, criar branch backup
6. **Consolidar** — múltiplos planos no mesmo arquivo = um PR

---

## Exemplo de Conversa

**Você:** "aumenta o tamanho dos ícones do header"
**Eu:** "Entendi. Vou usar @implementer. Antes, vou verificar dead code e criar um plano."

**Você:** "cria um plano para adicionar modo dark"
**Eu:** "Vou usar @planner. Criando plano em minimax-planos/..."

**Você:** "faz release 16.2.0"
**Eu:** "Vou usar @releaser. Checklist de pré-release..."

---

## Dica

Mencione o agent que você quer que eu use no início da mensagem. Isso me ajuda a entrar no contexto correto mais rápido.

---

## Estrutura de Arquivos

```
.claude/
├── agents/
│   ├── implementer.md   # Implementação de código
│   ├── tester.md       # QA e testes
│   ├── auditor.md      # Cleanup de contexto
│   ├── planner.md      # Criação de planos
│   └── releaser.md     # Releases
└── skills/
    ├── css-workflow.md     # Gatilho: *.css
    ├── plan-workflow.md    # Gatilho: minimax-planos/*.md
    └── test-workflow.md    # Gatilho: *.test.ts
```

---

## Referências

- AGENTS.md — Workflow completo e constraints
- BUSINESS_RULES.md — Regras de negócio
- CLAUDE.md — Arquitetura técnica