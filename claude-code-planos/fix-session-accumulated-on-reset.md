# fix: acumulado incorreto ao fechar sessão com 0%

**Status:** ✅ Concluído
**Branch:** fix/session-accumulated-on-reset#101
**Issue:** edilsonvilarinho/claude-usage-monitor#101
**Tipo:** bug fix

---

## Problema

Quando uma sessão de 5h expira/fecha, mesmo que o valor exibido de "Sessão" esteja em 0% no momento do fechamento, o acumulado salta para 100% (ou outro valor alto). O usuário via 0% no analytics mas o acumulado aumentou com um valor inesperado.

---

## Causa Raiz (2 bugs interligados)

### Bug 1 — Herança residual ao criar nova janela (`dailySnapshotService.ts:99`)

Quando um reset é detectado, a nova janela de sessão é criada com:
```typescript
peak: sessionPctInt >= (completedWindow?.peak ?? 0) ? 0 : sessionPctInt
```

**Problema:** quando `sessionPctInt < completedWindow.peak`, a nova janela herda `sessionPctInt` — o valor da API **no exato momento do reset**. Esse valor pode ser residual da sessão anterior (latência da API durante transição de janelas), inflando artificialmente o `peak` da nova sessão.

**Exemplo:**
- Sessão A pica em 100%, reseta
- No poll do reset, API ainda retorna 80% (resíduo da sessão A)
- Nova janela começa com `peak = 80`
- Nos polls seguintes, sessão está em 0%, mas `Math.max(80, 0) = 80` mantém o peak
- Quando essa janela reseta → `sessionAccum += 80`
- Mas o usuário via 0% o tempo todo!

### Bug 2 — IPC handler esconde o pico real (`main.ts:695`)

```typescript
return { ...w, peak: Math.round(lastUsageData.five_hour.utilization) };
```

O handler `get-current-session-window` retorna **apenas o valor ao vivo** como peak, não o máximo armazenado (`w.peak`). Se a sessão pica em 100% e cai para 0%, o analytics mostra `peak: 0%`. Quando a sessão fecha, o acumulado sobe 100% — mas o usuário sempre viu 0% no painel.

---

## Arquivos a modificar

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/services/dailySnapshotService.ts` | 99 | Iniciar nova janela sempre com `peak: 0` |
| `src/main.ts` | 695 | Retornar `Math.max(w.peak, live)` em vez de só `live` |

---

## Implementação

### Fix 1 — `src/services/dailySnapshotService.ts:99`

**De:**
```typescript
? { resetsAt: newResetsAt, peak: sessionPctInt >= (completedWindow?.peak ?? 0) ? 0 : sessionPctInt, final: 0, date: today, peakTs: undefined }
```

**Para:**
```typescript
? { resetsAt: newResetsAt, peak: 0, final: 0, date: today, peakTs: undefined }
```

**Por que é seguro:** O valor da nova sessão é capturado no poll seguinte via `Math.max(0, sessionPctInt)`. A perda da primeira leitura no poll do reset é aceitável pois essa leitura pode ser resíduo da sessão anterior. O acumulado da sessão antiga já foi adicionado antes dessa linha.

### Fix 2 — `src/main.ts:695`

**De:**
```typescript
return { ...w, peak: Math.round(lastUsageData.five_hour.utilization) };
```

**Para:**
```typescript
return { ...w, peak: Math.max(w.peak, Math.round(lastUsageData.five_hour.utilization)) };
```

**Por que:** O peak exibido no analytics nunca deve ser menor que o peak armazenado. O usuário passa a ver o pico real que será acumulado, eliminando a discrepância "vi 0% mas acumulou 100%".

---

## Verificação

1. `npm test` — testes de `dailySnapshotService.test.ts` devem continuar passando
2. `npm run build` — build limpo
3. Teste manual: abrir analytics modal com sessão em baixo uso, confirmar que pico exibido = pico que será acumulado

---

## Progresso

- [x] Plano criado
- [x] Issue criada no GitHub — edilsonvilarinho/claude-usage-monitor#101
- [x] Branch criada — fix/session-accumulated-on-reset#101
- [x] Fix 1 implementado (`dailySnapshotService.ts`)
- [x] Fix 2 implementado (`main.ts`)
- [x] Testes passando (387 testes)
- [x] Build limpo
- [ ] PR criado
