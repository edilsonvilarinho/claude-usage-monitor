# Fix: Aumentar tamanho dos ícones do header

**Status:** Aguardando confirmação para PR
**Branch:** `fix/header-icons-size`

---

## Objetivo

Aumentar tamanho dos botões/ícones do header para melhor visibilidade e área clicável.

---

## Mudanças — `src/renderer/styles.css`

| Seletor | Propriedade | Atual | Novo |
|---------|-------------|-------|------|
| `.icon-btn` | width, height | 24px | 32px |
| `.icon-btn` | font-size | 12px | 16px |
| `.smart-indicator` | width, height | 24px | 32px |
| `.smart-indicator-dot` | width, height | 12px | 16px |
| `#btn-online-users` | font-size | 11px | 13px |

---

## Verificação

1. `npm run build` — build limpo
2. `npm test` — 387 testes
3. Verificar visualmente os ícones do header

---

## Progresso

- [x] Plano criado
- [x] Branch criada
- [x] Implementar CSS
- [x] Build + testes
- [x] Commit + push
- [ ] PR (aguardando confirmação)