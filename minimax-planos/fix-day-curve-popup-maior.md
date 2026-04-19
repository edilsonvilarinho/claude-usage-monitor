# Fix: Aumentar tamanho do day-curve-popup

**Status:** Em progresso
**Branch:** `fix/day-curve-popup-maior`

---

## Contexto

O `day-curve-popup` foi redimensionado de `230px` para `400px` pelo plano `claude-code-planos/day-curve-popup-resize.md`. Porém, o usuário ainda acha o modal pequeno para facilitar a visualização.

---

## Mudanças

### `src/renderer/styles.css`

| Seletor | Atual | Novo |
|---------|-------|------|
| `.day-curve-popup` width | 400px | 550px |
| `.day-curve-chart-wrap` height | 190px | 280px |

---

## Verificação

1. `npm run build` — build limpo
2. `npm run dev` — clicar em data no histórico
3. Confirmar popup maior e mais legível

---

## Progresso

- [x] Plano criado
- [x] Branch criada
- [ ] Implementar CSS
- [ ] Build + testes
- [ ] Commit + push
- [ ] PR + merge