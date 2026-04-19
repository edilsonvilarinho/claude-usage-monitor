# Plano: Corrigir botão de excluir janelas fechadas no modal de relatório

## Context

O botão 🗑 (`.window-delete-btn`) é renderizado à direita de cada linha no modal de relatório de uso, após o elemento `.report-window-peak`. Este elemento exibe o percentual de uso + horário de pico (ex: `"82%<span>pico 14:30</span>"`), mas **não tem restrição de largura**.

O problema raiz é que `.report-modal-box` declara `overflow-y: auto`. Por especificação CSS, isso faz `overflow-x` também se tornar `auto` (não mais `visible`). Quando `.report-window-peak` cresce demais e empurra o botão além dos 364px úteis do modal (400px - 36px padding), o botão é cortado horizontalmente e some.

## Arquivos críticos

- `src/renderer/styles.css` — linhas 1461–1494 (`.report-window-peak` e `.window-delete-btn`)

## Mudanças planejadas

### `src/renderer/styles.css`

**1. Adicionar `flex-shrink` e truncamento ao `.report-window-peak`** (linha 1461):

```css
.report-window-peak {
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 1;        /* permite comprimir quando espaço é insuficiente */
  min-width: 0;          /* necessário para truncamento funcionar em flex */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;      /* limite razoável para pct + horário de pico */
}
```

**2. Aumentar opacidade base do botão** de `0.4` → `0.6` (linha 1487):

```css
.window-delete-btn {
  ...
  opacity: 0.6;  /* era 0.4 — mais visível sem ser intrusivo */
  ...
}
```

## Verificação

1. `npm run build` — confirmar compilação limpa
2. `npm run dev` — abrir modal de relatório
3. Verificar que o botão 🗑 aparece visível para janelas fechadas, inclusive em linhas com horário de pico longo
4. Verificar que ao passar o mouse o botão fica com `opacity: 1`
5. Confirmar que o texto de pico longo é truncado com `…` sem quebrar o layout
