# Fix: Aumentar ainda mais o day-curve-popup

**Status:** ✅ Concluído
**Branch:** `fix/day-curve-popup-maior-2`

---

## Contexto

Mesmo com o ajuste anterior (550px → mais espaço), o usuário ainda acha o modal pequeno. Melhoria para 85vw/450px.

---

## Mudanças

### `src/renderer/styles.css`

| Seletor | Atual | Novo |
|---------|-------|------|
| `.day-curve-popup` width | 550px | 85vw |
| `.day-curve-chart-wrap` height | 280px | 450px |

---

## Progresso

- [x] Plano criado
- [x] Branch criada
- [x] Implementar CSS
- [x] Build + testes
- [ ] Commit + push
- [ ] PR