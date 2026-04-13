# /skip — Análise Rápida

Analisa se precisa de código ou se pode responder direto.

> Use para: evitar trabalho desnecessário (~1k tokens)

**Quando usar:**
- "Como faria X?" → Se resposta óbvia → `/skip` + resposta direta
- "Pode explicar isso?" → Se não precisa de código → `/skip` + explicação
- "Tem outro jeito?" → Se alternativas simples → `/skip` + alternativas

**Fluxo:**
1. Analiso a pergunta
2. Se não precisar de código → respondemos direto
3. Se precisar → aviso "vou implementar" e executo

**Exemplo de input:**
```
/skip
Como faria para mostrar notificação quando uso > 80%?
```

**Exemplo de output:**
```
→ Sem código necessário.

Basta chamar `showToast(title, body)` de notificationService.
Não precisa de nova implementação.
```
