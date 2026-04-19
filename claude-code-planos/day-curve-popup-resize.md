# Plano: Ajustar tamanho do modal day-curve-popup

**Status:** ✅ Concluído

## Contexto
O `day-curve-popup` exibe a curva de uso do dia ao clicar em uma data no histórico. Atualmente está configurado como um tooltip pequeno (230px × ~110px) posicionado dinamicamente próximo ao elemento âncora. O usuário quer que tenha o mesmo padrão visual/tamanho do modal de relatório de uso (`report-modal-box`: 400px de largura, max-height 88vh).

## Mudanças necessárias

### 1. CSS — `src/renderer/styles.css`

Substituir o estilo atual do `.day-curve-popup` (tooltip posicionado absolutamente) por um estilo de modal centralizado equivalente ao `.report-modal-box`:

```css
/* ANTES */
.day-curve-popup {
  position: absolute;
  z-index: 300;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  width: 230px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.day-curve-chart-wrap { height: 80px; position: relative; }

/* DEPOIS */
.day-curve-popup {
  background: var(--bg-solid);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 18px 14px;
  width: 400px;
  max-height: 88vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  animation: fadeInScale 0.25s var(--ease-out) forwards;
}
.day-curve-chart-wrap { height: 190px; position: relative; }
```

### 2. HTML — Remover dead code

O componente `src/renderer/components/modais/day-curve-popup.js` era dead code e foi removido. O HTML estático já existe no `index.html`.

### 3. TypeScript — `src/renderer/app.ts`

Atualizar `openDayCurvePopup` e `closeDayCurvePopup` para manipular `#day-curve-overlay` em vez do popup diretamente, removendo o posicionamento dinâmico (rect/left/top):

- `openDayCurvePopup`: remover cálculo de `rect` e posicionamento absoluto; mostrar `#day-curve-overlay`
- `closeDayCurvePopup`: esconder `#day-curve-overlay`

## Arquivos a modificar

| Arquivo | O que muda |
|---|---|
| `src/renderer/styles.css` | Dimensões `.day-curve-popup` (width→400px, max-height→88vh) e `.day-curve-chart-wrap` (height→190px) |
| `src/renderer/app.ts` | Ajustar `openDayCurvePopup`/`closeDayCurvePopup` para usar overlay |

## Verificação

1. `npm run build` — sem erros TypeScript
2. `npm run dev` — abrir o popup de dia clicando em uma data no histórico
3. Confirmar que o popup aparece centralizado, com backdrop escuro, tamanho igual ao modal de relatório
4. Confirmar que fechar funciona (botão ✕ e clique no overlay)
