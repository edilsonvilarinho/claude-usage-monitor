# Plano: Diferenciar Visualmente Smart Plan e Server Status

**Data:** 2026-04-16
**Última atualização:** 2026-04-16 11:10:00
**Status:** CONCLUÍDO

---

## Problema

Ambos os indicadores usam "bolinha" como ícone:
- Smart Plan: bolinha sólida com cor do semáforo (verde/amarelo/vermelho)
- Server Status: bolinha com animação pulse

Isso pode confundir o usuário pois visualmente são muito similares.

---

## Solução: Opção A

Diferenciar visualmente usando estilos diferentes:

| Indicador | Estilo |
|-----------|--------|
| Smart Plan | Bolinha **sólida** com cor do semáforo |
| Server Status | Bolinha **com animação pulse** (não sólida) |

---

## Análise do CSS Atual

### Smart Plan (`styles.css`):
```css
.smart-indicator-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  /* Cor vem via inline style ou classe */
}
```

### Server Status (`styles.css`):
```css
.server-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: server-status-pulse 3s ease-in-out infinite;
}

@keyframes server-status-pulse {
  0%, 100% { opacity: 0.7; transform: scale(0.92); }
  50% { opacity: 1; transform: scale(1); }
}
```

---

## Mudanças Necessárias

### 1. CSS: Adicionar estilo "sólido" para Smart Plan

```css
.smart-indicator-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  /* Mantém cor do semáforo mas adiciona sombra para parecer 3D/sólido */
  box-shadow: inset 0 -2px 4px rgba(0,0,0,0.3);
}
```

### 2. CSS: Garantir que Server Status tenha animação pulse

Já tem animação `server-status-pulse` - manter.

Diferenciar removendo `box-shadow` ou usando estilo diferente:
```css
.server-status-dot {
  /* Sem sombra, apenas a animação */
}
```

### 3. Resultado Visual

| Indicador | Visual |
|-----------|--------|
| Smart Plan | ● Sólido com sombra (3D look) |
| Server Status | ● Pulse animation (sem sombra) |

---

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/renderer/styles.css` | Adicionar estilo sólido para Smart Plan |
| `minimax-planos/smart-plan-icon-differentiation.md` | Este plano |

---

## Etapas:

| # | Descrição | Status | Data/Hora |
|---|-----------|--------|-----------|
| 1 | Criar plano em minimax-planos/ | ✅ Concluído | 2026-04-16 11:10:00 |
| 2 | CSS: adicionar estilo "sólido" para .smart-indicator-dot | ✅ Concluído | 2026-04-16 11:15:00 |
| 3 | CSS: Server Status mantém pulse (já estava) | ✅ Concluído | 2026-04-16 11:15:00 |
| 4 | Build + Testes | 🔄 Pendente | - |
| 5 | Commit + Push | 🔄 Pendente | - |
