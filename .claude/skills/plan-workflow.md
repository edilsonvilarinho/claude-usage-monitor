---
name: plan-workflow
description: Usar quando criar ou atualizar planos em minimax-planos/ — inclui template e padrões.
trigger: "minimax-planos/*.md"
---

## Plan Workflow Skill

Quando trabalhando com planos em `minimax-planos/`:

### Template de Plano

```markdown
# [Tipo]: [Nome Curto]

**Status:** [Planejado|Em progresso|✅ Concluído]
**Branch:** `tipo/nome-curto#issue`
**Issue:** #numero (se aplicável)

---

## Objetivo

[Descrição clara do que será feito]

## Análise

- [ ] Dead code relacionado?
- [ ] Duplicação com código existente?
- [ ] Planos anteriores?
- [ ] Arquivos afetados?

## Mudanças

| Seletor/Arquivo | Antes | Depois |
|-----------------|-------|--------|
| `src/...` | ... | ... |

## Progresso

- [ ] Analisar problema
- [ ] Verificar dead code/duplicação
- [ ] Criar/anotar plano
- [ ] Criar branch
- [ ] Implementar
- [ ] Build + testes
- [ ] Commit + push
- [ ] PR (aguardando confirmação)
- [ ] Merge
```

### Padrão de Nomenclatura

```
minimax-planos/[tipo]-[nome-curto].md

Exemplos:
- fix-header-icons-size.md
- remove-dead-code-components.md
- fix-day-curve-popup-maior.md
```

### Regras

1. **Sempre** criar em `minimax-planos/` (não em `claude-code-planos/`)
2. **Atualizar progresso** imediatamente após cada checkpoint
3. **Incluir Issue** quando aplicável
4. **Commit no mesmo PR** das mudanças de código

### Consolidação

Se múltiplos planos afetam o mesmo arquivo:
1. Identificar conflito
2. Comunicar ao usuário
3. Consolidar em um único plano/PR

### Quando Criar Plano

- Usuário solicita nova tarefa
- Bug identificado precisa de análise
- Feature request precisa de planejamento
- Antes de qualquer implementação significativa