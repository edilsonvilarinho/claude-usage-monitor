# Fix: Remover HTML duplicado do day-curve-popup no index.html

**Status:** Em progresso
**Branch:** `fix/day-curve-duplicado-html`

---

## Problema

Existem duas versões do HTML do `day-curve-popup`:

1. **`index.html` (linha 670):** `div#day-curve-popup.hidden` — versão antiga sem overlay wrapper
2. **`day-curve-popup.js`:** `div#day-curve-overlay.modal-overlay` + `div#day-curve-popup` — versão nova com overlay

O app.ts referencia `#day-curve-overlay` (versão nova via componente injetado), mas o index.html tem a versão antiga estática que pode estar conflitando.

IDs duplicados causam comportamento indefinido — o CSS pode estar aplicando na versão errada.

---

## Solução

Remover o HTML estático duplicado do `index.html` (linhas 670-679):

```html
<!-- REMOVER ESTE BLOCO -->
  <div id="day-curve-popup" class="day-curve-popup hidden">
    <div class="day-curve-header">
      <span id="day-curve-title" class="day-curve-title"></span>
      <button id="day-curve-close" class="icon-btn" style="font-size:10px;padding:2px 5px;">✕</button>
    </div>
    <div class="day-curve-chart-wrap">
      <canvas id="day-curve-canvas"></canvas>
    </div>
    <div id="day-curve-empty" class="day-curve-empty hidden">Sem dados</div>
  </div>
```

O componente moderno já é injetado via `injectAllModals()` em `components/modais/index.js`.

---

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/renderer/index.html` | Remover linhas 670-679 (bloco day-curve-popup) |

---

## Verificação

1. `npm run build` — build limpo
2. `npm run dev` — testar popup de dia
3. Confirmar que popup aparece corretamente e dimensões funcionam

---

## Progresso

- [x] Plano criado
- [x] Branch criada
- [ ] Remover HTML duplicado
- [ ] Build + testes
- [ ] Commit + push
- [ ] PR + merge