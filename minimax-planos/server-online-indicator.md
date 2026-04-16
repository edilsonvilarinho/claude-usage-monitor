# Plano: Server Online Indicator - Histórico

**Data criação:** 2026-04-16
**Última atualização:** 2026-04-16 11:00:00
**Status:** CONCLUÍDO (TODAS AS VERSÕES MERGEADAS)

---

## Plano v6: Contador (n-1) + Ícone Melhorado

**Data:** 2026-04-16 10:40:00
**Status:** EM IMPLEMENTAÇÃO

### Problemas

1. **Contador mostra você mesmo** - quando você conecta, conta como 1 usuário
2. **Ícone não está bom** - precisa melhorar visual

### Solução

#### 1. Contador (n-1)

Server gera `clientId` único por conexão:

```typescript
// Server: ws.ts - ao conectar
const clientId = crypto.randomUUID();
ws.send(JSON.stringify({
  type: 'connected',
  timestamp: Date.now(),
  clientId: clientId
}));

// Broadcast: count exclui quem recebeu
broadcastToClients({ type: 'client_count', count: clients.size - 1, timestamp: Date.now() });
```

Client guarda seu `clientId`:

```typescript
// serverStatusService.ts
private myClientId: string | null = null;

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'connected' && msg.clientId) {
    this.myClientId = msg.clientId;
  }
  // ...
});
```

#### 2. Ícone melhorado

Dois círculos estilo "usuários":

```html
<svg width="16" height="12" viewBox="0 0 16 12">
  <circle cx="5" cy="4" r="3" fill="currentColor"/>
  <circle cx="11" cy="4" r="3" fill="currentColor" opacity="0.6"/>
</svg>
```

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `server/src/routes/ws.ts` | Gerar clientId, enviar no handshake |
| `src/services/serverStatusService.ts` | Guardar myClientId |
| `src/renderer/index.html` | Novo ícone SVG |
| `src/renderer/app.ts` | Lógica (n-1) |

### Etapas v6:

| # | Descrição | Status | Data/Hora |
|---|-----------|--------|-----------|
| 1 | Server: gerar clientId e enviar no handshake | ✅ Concluído | 2026-04-16 10:50:00 |
| 2 | Client: guardar myClientId | ✅ Concluído | 2026-04-16 10:51:00 |
| 3 | Client: broadcast count = size - 1 | ✅ Concluído | 2026-04-16 10:51:30 |
| 4 | Renderer: novo ícone SVG | ✅ Concluído | 2026-04-16 10:52:00 |
| 5 | Build + Testes | ✅ Concluído | 2026-04-16 10:52:52 |
| 6 | Commit + Push + PR | ✅ Concluído | 2026-04-16 10:53:21 |

---

## Histórico de Versões

### v1: Indicador Server Status (Concluído)
- Conexão WebSocket com servidor
- Detecção online/offline em tempo real
- Reconexão automática com exponential backoff

### v2: Melhorias UI (Concluído)
- Suporte i18n (PT-BR/EN)
- Animação respiração suave
- Tooltip com IP do servidor

### v3: Correções + Indicador Usuários (Concluído)
- Pulse suave em todos os status
- Indicador de usuários online ([👤N])
- Broadcast de contagem de clientes

### v4: Fix Reconexão (Concluído)
- Não mostrar connecting durante reconexão
- Mostrar offline ao invés disso

### v5: Fix Mapeamento CSS (Concluído)
- Corrigido status 'connected' → classe 'online'

### v6: Contador n-1 + Ícone Melhorado (Concluído)
- Server gera clientId único por conexão
- Broadcast count = size - 1 (exclui você)
- Ícone: dois círculos SVG

### v7: Ícone Emoji (Concluído)
- Ícone SVG circles substituído por emoji 👤

---

## IP do Servidor (hardcoded)

```
ws://104.131.23.0:3030/ws
```
