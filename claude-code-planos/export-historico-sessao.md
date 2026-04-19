# Plano: Export de Dados do Histórico de Sessão (Otimizado)

## Context
A tela de detalhe do dia (`openDayDetailModal`) exibe um gráfico de linha com a série temporal de consumo (session, weekly, credits). O usuário quer exportar esses dados de forma otimizada — mantendo apenas os pontos onde houve **mudança de valor**, eliminando redundâncias.

Exemplo: 13:00→5%, 13:20→10%, 13:30→10%, 13:40→10%, 13:50→20%, 14:00→0%
→ Export: 13:00→5%, 13:20→10%, 13:50→20%, 14:00→0%

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/renderer/index.html` | Adicionar botão de export no `day-detail-header` |
| `src/renderer/app.ts` | Lógica de deduplicação + handler do botão + download JSON |
| `src/renderer/styles.css` | Estilo do botão de export (reaproveitando `.day-detail-close-btn`) |

## Decisões Confirmadas
- **Formato**: JSON download (arquivo `claude-usage-YYYY-MM-DD.json`)
- **Local do botão**: Header do modal de detalhe do dia, ao lado do ✕

## Implementação

### 1. HTML — Botão no header do modal (index.html ~linha 172)
Adicionar antes do botão de fechar:
```html
<button id="day-detail-export" class="day-detail-close-btn" title="Exportar dados" style="display:none">↓</button>
```
(oculto por padrão; exibido apenas quando há dados)

### 2. Lógica de deduplicação (app.ts)
Função pura dentro de `openDayDetailModal` (ou no escopo do módulo):
```typescript
function filterChangedPoints(points: TimeSeriesPoint[]) {
  if (points.length === 0) return [];
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    if (curr.session !== prev.session || curr.weekly !== prev.weekly || curr.credits !== prev.credits) {
      result.push(curr);
    }
  }
  return result;
}
```

### 3. Formato do JSON exportado
```json
{
  "date": "2026-04-19",
  "exportedAt": "2026-04-19T13:45:00.000Z",
  "totalPoints": 48,
  "filteredPoints": 12,
  "timeSeries": [
    { "ts": 1745000000000, "time": "13:00", "session": 5, "weekly": 10 },
    { "ts": 1745001200000, "time": "13:20", "session": 10, "weekly": 12 }
  ]
}
```
- `time` = formatado em HH:mm no locale local
- `session` e `weekly` são os valores brutos (podem exceder 100)
- `credits` incluído apenas se disponível

### 4. Mecanismo de download (app.ts — dentro de openDayDetailModal)
```typescript
const exportBtn = document.getElementById('day-detail-export') as HTMLButtonElement;

// Mostrar/ocultar conforme dados
exportBtn.style.display = points.length > 0 ? '' : 'none';

exportBtn.onclick = () => {
  const filtered = filterChangedPoints(points);
  const payload = {
    date,
    exportedAt: new Date().toISOString(),
    totalPoints: points.length,
    filteredPoints: filtered.length,
    timeSeries: filtered.map(p => ({
      ts: p.ts,
      time: new Date(p.ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
      session: p.session,
      weekly: p.weekly,
      ...(p.credits != null ? { credits: p.credits } : {}),
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `claude-usage-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
```

### 5. Estilo (styles.css)
O botão reutiliza `.day-detail-close-btn` — sem necessidade de nova classe.
Apenas garantir que o ícone ↓ fique visível e consistente.

## Pontos de Atenção
- O botão deve ser **resetado** entre aberturas do modal (onclick reatribuído a cada chamada de `openDayDetailModal`)
- Quando `points.length === 0`, ocultar o botão (não só desabilitar)
- Os valores `session`/`weekly` exportados são os **brutos** da API (podem ser > 100, ex: 1600%)
- A deduplicação compara `session`, `weekly` e `credits` — qualquer mudança em qualquer campo inclui o ponto

## Verificação
1. `npm run dev` → abrir app → clicar em dia com dados → verificar botão ↓ no header do modal
2. Clicar no botão → arquivo `claude-usage-YYYY-MM-DD.json` deve ser baixado
3. Verificar que pontos consecutivos iguais foram eliminados
4. Clicar em dia sem dados → botão não deve aparecer
5. `npm run build` deve compilar sem erros

## Status
- [ ] Implementação
- [ ] Verificação
