# /compact — Resume Código

Resume código em 3 linhas (o que faz, entrada, saída).

> Use para: entender arquivos longos sem ler tudo

**Quando usar:**
- "O que faz esse arquivo?" → `/compact src/services/pollingService.ts`
- "Resume esse modulo" → `/compact src/models/`
- "Do que se trata esse serviço?" → `/compact usageApiService.ts`

**Exemplo de input:**
```
/compact src/services/syncService.ts
```

**Exemplo de output:**
```
Sincronização com servidor cloud.
- push: envia dados locais (daily, sessionWindows)
- pull: baixa dados do servidor, aplica merge
- outbox: fila de operações pendentes com retry
```
