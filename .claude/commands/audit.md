# /audit — Auditoria Lean

Auditoria rápida com output minimalista.

> Use para: verificar algo sem análise profunda (~50 tokens)

**Quando usar:**
- "Esse código tem bug?" → `/audit pollingService.ts` (quick check)
- "Testes passando?" → `/audit --tests`
- "Coverage baixo?" → `/audit --coverage`
- "Arquivos modificados?" → `/audit --changed`

**Exemplo de input:**
```
/audit syncService.ts
```

**Exemplo de output:**
```
syncService.ts:
- 568 linhas, 85% cobertura
- syncNow() — principal (pull + push)
- ensureValidJwt() — re-exchange automático
- OK, sem issues óbvias
```
