# Fix: dados errados no registro de fechamento de janela de sessão

## Contexto

Ao fechar uma janela de sessão de 5h, o registro gerado em `sessionWindows` contém:
- `final: 0` — deveria ser o último valor não-zero antes do reset (ex: 94%)
- `maxSession` sobrescrito com 0 no DailySnapshot — deveria preservar o pico histórico do dia

**Exportação de backup confirma os dados errados:**
```json
// sessionWindows
{ "resetsAt": "2026-04-19T01:00:00...", "peak": 100, "final": 0, "date": "2026-04-18" }
// usageHistory mostra: session: 94 → session: 0 (reset)
```

## Causa Raiz

**Bug 1 — `final: 0` (race condition da API)**

A API pode retornar `utilization=0` com o `resets_at` antigo antes de refletir o reset
oficialmente. Nesse poll intermediário, o código atualiza:
```typescript
// dailySnapshotService.ts linha 102
final: sessionPctInt  // → 0 (sem reset detectado ainda)
```
No poll seguinte, o reset é detectado, mas `currentWindow.final` já está em 0
→ `completedWindow.final = 0` (deveria ser 94%).

**Bug 2 — `maxSession` sobrescrito com 0 na detecção de reset**

```typescript
// dailySnapshotService.ts linha 67
existingDay.maxSession = sessionPctInt;  // sessionPctInt = 0 (nova janela recém-iniciada)
```
Destroi o pico histórico do dia. O branch sem reset já usa `Math.max` corretamente.

## Correções

### Fix 1 — linha 102
```typescript
// ANTES:
final: sessionPctInt,
// DEPOIS:
final: sessionPctInt > 0 ? sessionPctInt : currentWindow.final,
```

### Fix 2 — linha 67
```typescript
// ANTES:
existingDay.maxSession = sessionPctInt;
// DEPOIS:
existingDay.maxSession = Math.max(existingDay.maxSession ?? 0, peak);
```

## Arquivo
`src/services/dailySnapshotService.ts`

## Status
✅ Concluído
