---
name: css-workflow
description: Usar quando fizer alterações em arquivos .css — inclui checklist de reiniciar dev server e screenshot.
trigger: "*.css"
---

## CSS Workflow Skill

Quando trabalhando com arquivos `.css`:

### Antes de implementar
- [ ] Verificar se já existe estilo similar no CSS
- [ ] Pedir screenshot do estado atual ao usuário (se mudança visual)

### Após implementar
- [ ] **REINICIAR dev server** — CSS pode não refletir sem restart:

```bash
taskkill /F /IM node.exe  # Windows
# ou pkill -f electron # Linux
npm run build && npm run dev
```

### Após verificar visualmente
- [ ] Pedir screenshot do resultado ao usuário
- [ ] Comparar antes/depois
- [ ] Apenas fazer commit se o usuário aprovar

### Propriedades comuns a verificar
- `width`, `height`, `max-width`, `max-height`
- `font-size`
- `padding`, `margin`
- `border-radius`
- `opacity`
- `color`

### Padrão de nomenclatura de classes
- `.icon-btn` — botões de ícone do header
- `.modal-overlay` — overlay de modais
- `.modal-box` — caixa interna do modal
- `.smart-indicator` — indicador do smart plan
- `.report-*` — estilos do modal de relatório
- `.day-curve-*` — estilos do popup de curva diária

## Reiniciar Dev Server

```bash
taskkill /F /IM node.exe  # Windows
npm run build && npm run dev
```

CSS cache não atualiza sem restart completo.