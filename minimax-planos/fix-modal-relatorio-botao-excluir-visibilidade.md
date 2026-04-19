# Fix: botão excluir no modal de relatório — ícone pouco visível

**Status:** ✅ Concluído
**Branch:** `fix/modal-relatorio-botao-excluir-visibilidade`

---

## Problema

No modal de relatório de uso, o botão 🗑 (`.window-delete-btn`) para excluir janelas fechadas está:
1. **Muito pequeno** — font-size: 12px
2. **Pouco visível** — opacity 0.6, mesma cor do texto
3. **Sem destaque** — cor igual ao texto de pico, não contrasta

## Screenshots

- `C:\Users\edils\Downloads\claude\8.png` — problema visível

---

## Arquivos a modificar

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/renderer/styles.css` | ~1489 | `.window-delete-btn` — ícone vermelho, opacity 1, fonte maior |

---

## Implementação

### `src/renderer/styles.css` — `.window-delete-btn`

**De:**
```css
.window-delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
  opacity: 0.6;
  transition: opacity 0.15s;
  flex-shrink: 0;
}
```

**Para:**
```css
.window-delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  opacity: 1;
  transition: opacity 0.15s;
  flex-shrink: 0;
  color: #ef4444;
  border-radius: 4px;
}
.window-delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}
```

---

## Verificação

1. `npm run build` — build limpo
2. `npm run dev` — abrir modal de relatório
3. Confirmar que ícone 🗑 está vermelho, grande, fácil de clicar
4. Hover mostra fundo vermelho sutil

---

## Progresso

- [x] Plano criado
- [x] Branch criada
- [x] Implementar CSS
- [x] Build + testes
- [x] Commit + push
- [ ] PR