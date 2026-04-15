# Plano de Correção - Modal de Credencial Não Aparece

**Data:** 15/04/2026
**Hora:** 16:30:00

---

## Problema

O modal de credencial (`credential-modal`) não aparece quando há erro de token expirado/ausente. O evento `credentials-expired` é emitido antes do renderer estar pronto para recebê-lo, causando uma **race condition**.

---

## Causa Raiz

### Fluxo atual problemático:

1. App inicia → `pollingService.start()` → `pollingService.poll()`
2. `fetchUsageData()` → `getAccessToken()` → `refreshToken()` falha
3. `credentialService.ts` (linha 168) emite `credentials-expired` para todas as janelas
4. **MAS o renderer (app.ts) AINDA NÃO CARREGOU** → listener `onCredentialsExpired` não existe ainda
5. Evento é perdido = modal nunca aparece

### Por que isso acontece:

- O main process carrega antes do renderer
- O evento é emitido imediatamente durante o startup
- O evento `credentials-expired` deve ser reenviado quando o popup mostra/renderer está pronto

---

## Solução Proposta: Opção A (Recomendada)

### Estratégia:

Reenviar o evento `credentials-expired` quando o popup é mostrado, similar ao que já existe para `credential-missing` (linha 218-219 do main.ts).

### Mudanças necessárias:

#### 1. `src/main.ts`

```typescript
// PARTE 1: Adicionar variável de estado (próximo à linha 60)
let credentialsExpiredSent = false;

// PARTE 2: Quando credentialService emite credentials-expired, marcar flag (credService)
// Na verdade, isso já acontece no credentialService.ts emitindo para todas as janelas
// Precisamos rastrear se foi enviado antes do renderer estar pronto

// PARTE 3: No showPopup() - around lines 201-226
// Adicionar verificação e reenvio:
if (credentialsExpiredSent) {
  popup.webContents.send('credentials-expired');
}
```

**Por que é necessário:**

- `credential-missing` já tem essa lógica (linha 218-219)
- `credentials-expired` precisa do mesmo tratamento

---

## Análise de Código Existente

### Como `credential-missing` funciona (referência):

```typescript
// main.ts lines 109-112 (envio inicial quando janela carrega)
win.webContents.once('did-finish-load', () => {
  if (credentialMissing) {
    win.webContents.send('credential-missing', credentialPath);
  }
});

// main.ts lines 217-220 (reenvio quando popup mostra)
if (credentialMissing) {
  popup.webContents.send('credential-missing', credentialPath);
}
```

### O mesmo padrão deve ser aplicado para `credentials-expired`

---

## Files a Modificar

| File | Mudanças |
|------|----------|
| `src/main.ts` | +1 variável `credentialsExpiredSent`, + lógica de reenvio em `showPopup()` |

---

## Alternativas Consideradas

### Opção B: Usar IPC mais explícito

Não recomendada - adicionaria complexidade desnecessária.

### Opção C: Mudar ordem de carregamento

Não recomendada - afetaria outras funcionalidades.

---

## Passos de Implementação

1. Adicionar `let credentialsExpiredSent = false` no main.ts (perto da linha 60)
2. Adicionar onde o evento é ouvido e marcar a flag
3. Adicionar verificação `if (credentialsExpiredSent)` no `showPopup()` (perto da linha 218)
4. Testar manualmente

---

## Como Validar

1. Rodar `npm run dev`
2. Esperar erro "Token refresh failed"
3. Abrir DevTools (Ctrl+Shift+I)
4. Verificar se log `[Renderer] onCredentialsExpired fired` aparece
5. Verificar se modal aparece

---

## Progresso

| Data | Hora | Status | Descrição |
|------|------|--------|-----------|
| 15/04/2026 | 16:30:00 | Pendente | Plano criado |
| 15/04/2026 | 16:35:00 | Em Progresso | Implementando correção |
| 15/04/2026 | 16:38:00 | Concluído | Correção implementada |

---

## Histórico de Alterações

- 15/04/2026 16:30:00 - Criado o plano
- 15/04/2026 16:35:00 - Adicionada variável `credentialExpiredSent` no main.ts
- 15/04/2026 16:35:30 - Adicionado IPC listener para rastrear evento
- 15/04/2026 16:36:00 - Adicionado reenvio em showPopup()
- 15/04/2026 16:37:00 - Modificado preload para send back ao main
- 15/04/2026 16:38:00 - TypeScript compilado com sucesso

---

## Novo Problema: Rate Limit Banner Incorreto

Quando há problema de credencial, o banner "Limite de Requisições" aparece incorretamente.
Isso acontece porque a API retorna 429 (rate limit) quando o token está expirado.

### Correção Implementada

Em `src/main.ts`, modificado `pollingService.on('rate-limited')` para ignorar se já houve cred error:

```typescript
pollingService.on('rate-limited', (until: number, count: number, resetAt?: number) => {
  if (credentialMissing || credentialExpiredSent) {
    return;
  }
  // ... resto do código
});
```

### Progresso Adicional

| Data | Hora | Status |
|------|------|--------|
| 15/04/2026 16:52 | Concluído |

---

## Novo Problema: Botão "Tentar Novamente" Não Funciona

**Data:** 15/04/2026

O botão `credential-retry-btn` não funciona quando há rate limit. O log mostra:
```
[PollingService] Skipping triggerNow — still rate limited
```

### Causa

O botão chama `refreshNow()` que verifica `isRateLimited` antes de executar.  
Se está em rate limit, retorna early sem tentar a API.

### Solução

Mudar de `refreshNow()` para `forceRefreshNow()` - que ignora o rate limit.

### Código:

```typescript
// Em app.ts, cambiar:
// await window.claudeUsage.refreshNow();
// para:
await window.claudeUsage.forceRefreshNow();
```

---

## Progresso

| Data | Hora | Status |
|------|------|--------|
| 15/04/2026 | 16:55 | Concluído |

---

## Histórico de Alterações

- 15/04/2026 16:55:00 - Alterado `refreshNow()` para `forceRefreshNow()` no botão

---

## Novo Problema: Botão "Tentar Novamente" Não Funciona

**Data:** 15/04/2026

**Log:**
```
credentialMissing: false
credentialMissing: true
credentialMissing: true
...
```

O `credentialMissing` **NÃO volta para `false`** quando a credencial é gerada corretamente.

### Causa Raiz

O código **NÃO reseta** `credentialMissing` / `credentialExpiredSent` quando a credencial funciona.

### Solução

Em `main.ts`, resetar o estado quando:
1. O arquivo de credencial é lido com sucesso
2. O usuário clica em "Tentar novamente"

```typescript
// No 'refresh-now' handler, antes de fazer poll:
credentialMissing = false;
credentialExpiredSent = false;
```

### Progresso

| Data | Hora | Status |
|------|------|--------|
| 15/04/2026 | ~17:10 | Concluído |

---

## Histórico de Alterações

- 15/04/2026 17:10:00 - Reset `credentialMissing` e `credentialExpiredSent` nos handlers de refresh