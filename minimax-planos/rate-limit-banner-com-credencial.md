# Plano - Rate Limit Banner Com Modal de Credencial

**Data:** 15/04/2026
**Hora:** 16:42:00

---

## Problema

Quando o modal de credencial (`credential-modal`) está na tela, o banner de rate limit (`rate-limit-banner`) também aparece. Isso não deveria acontecer - quando há problema de credencial, o banner de rate limit deveria estar escondido.

---

## Análise

### Código existente:

Em `src/renderer/app.ts`, os handlers já chiam `clearRateLimitBanner()`:

```typescript
// Linha ~2272
window.claudeUsage.onCredentialMissing((credPath: string) => {
  clearRateLimitBanner();
  // ...
});

// Linha ~2284
window.claudeUsage.onCredentialsExpired(() => {
  clearRateLimitBanner();
  // ...
});
```

### Possíveis causas:

1. O banner está sendo mostrado **DEPOIS** do modal abrir (race condition)
2. O banner está sendo mostrado pelo polling service, não pelo renderer
3. O `clearRateLimitBanner()` não está sendo chamado no momento certo

---

## Solução Proposta

### Estratégia:

Modificar `startRateLimitCountdown()` em `app.ts` para verificar se o modal de credencial está aberto antes de mostrar o banner.

### Alteração necessária:

```typescript
function startRateLimitCountdown(until: number, resetAt?: number): void {
  // Se modal de credencial está aberto, não mostrar banner
  const credModal = document.getElementById('credential-modal');
  if (!credModal?.classList.contains('hidden')) {
    return;
  }
  // ... resto do código
}
```

---

## Files a Modificar

| File | Mudança |
|------|---------|
| `src/renderer/app.ts` | Modificar `startRateLimitCountdown()` |

---

## Progresso

| Data | Hora | Status | Descrição |
|------|------|--------|-----------|
| 15/04/2026 | 16:42:00 | Pendente | Plano criado |
| 15/04/2026 | 16:45:00 | Em Progresso | Implementando correção |
| 15/04/2026 | 16:47:00 | Concluído | Correção implementada |

---

## Histórico

- 15/04/2026 16:42:00 - Criado plano
- 15/04/2026 16:47:00 - Modificado `startRateLimitCountdown()` para verificar modal de credencial
- 15/04/2026 16:47:30 - TypeScript compilado com sucesso