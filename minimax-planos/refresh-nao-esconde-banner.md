# Plano: Botão Refresh Não Esconde Banner de Rate Limit

**Data:** 15/04/2026
**Hora:** 17:00

---

## Problema

Quando o usuário clica em "Forçar Atualização", o banner de rate limit não é escondido.

---

## Causa Raiz

1. `forceRefreshNow()` é chamado via `modal-confirm`
2. O código **NÃO** esconde o banner imediatamente
3. O código depende do `onUsageUpdated` → `updateUI` → `clearRateLimitBanner()`
4. Mas se a API retorna **erro**, `onUsageUpdated` **NÃO** é disparado
5. Banner fica visível para sempre

---

## Solução Proposta

Adicionar `clearRateLimitBanner()` no handler do `modal-confirm`, **ANTES** de chamar `forceRefreshNow()`.

**Arquivo:** `src/renderer/app.ts`

```typescript
document.getElementById('modal-confirm')!.addEventListener('click', () => {
  const btn = document.getElementById('modal-confirm') as HTMLButtonElement;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = tr().forcingText;
  document.getElementById('force-refresh-modal')!.classList.add('hidden');
  clearRateLimitBanner();  // ← ADICIONAR ISSO
  (document.getElementById('updated-text') as HTMLElement).textContent = tr().refreshingText;
  void window.claudeUsage.forceRefreshNow().finally(() => {
    btn.disabled = false;
    btn.textContent = originalText;
  });
});
```

---

## Progresso

| Data | Hora | Status |
|------|------|--------|
| 15/04/2026 | 17:00 | Concluído |

---

## Histórico

- 15/04/2026 17:00 - Criado plano
- 15/04/2026 17:02 - Adicionado `clearRateLimitBanner()` no handler do modal-confirm
- 15/04/2026 17:02 - TypeScript compilado com sucesso