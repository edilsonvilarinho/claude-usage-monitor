# Plano: Ações de limpeza no modal de Relatório de Uso

**Status:** concluído (com fixes posteriores) — issue #103 | PR #104

## Checklist de progresso

### feat: implementação inicial (PR #104)
- [x] Issue criada (#103)
- [x] Branch criada (`feat/modal-relatorio-limpeza#103`)
- [x] IPC handlers adicionados em `main.ts`
- [x] Bridges adicionadas em `preload.ts`
- [x] Botão "Limpar tudo" e lixeiras implementados em `app.ts`
- [x] Estilos adicionados em `styles.css`
- [x] `npm run build` sem erros
- [x] Commit criado
- [x] PR aberto (#104)

### fix: janela aberta sumindo + limpar tudo preservar sessão aberta (PR #106, closes #105)
- [x] Early return em `openReportModal()` corrigido — janela aberta agora aparece mesmo sem fechadas
- [x] `clear-all-report-data` não apaga mais `currentSessionWindow`
- [x] `isPtBR`, `fmt`, `recentWindows` movidos para antes do bloco condicional

### fix: janela aberta exibia pico histórico em vez do valor atual (PR #108, closes #107)
- [x] `buildRow` corrigido: usa `final` (valor atual) para ambas aberta e fechada, não `peak`
- [x] IPC `get-current-session-window` atualiza `final` com valor ao vivo do `lastUsageData`

## Contexto
O modal de relatório (`#report-modal`) exibe gráfico, cards de estatísticas e lista de até 10 janelas de sessão recentes. O usuário quer duas novas ações:
1. **Limpar todos os dados** — apaga `dailyHistory` + `sessionWindows` + `currentSessionWindow` da conta ativa.
2. **Deletar uma janela individual** — remove uma entrada específica de `sessionWindows` pelo campo `resetsAt`.

Após qualquer deleção, o modal deve **re-renderizar completamente** (gráfico + stats + janelas + analytics), buscando os dados atualizados do store. Isso garante que os cálculos (pico, média, dias monitorados, streak, etc.) sejam refeitos na hora da exclusão.

---

## Arquivos críticos

| Arquivo | O que muda |
|---|---|
| `src/main.ts` | +2 IPC handlers: `clear-all-report-data` e `delete-session-window` |
| `src/preload.ts` | +2 bridges expostas ao renderer |
| `src/renderer/app.ts` | Botão "Limpar tudo" no header; ícone de lixeira em cada janela fechada; re-render completo após exclusão |
| `src/renderer/styles.css` | Estilos do botão "Limpar tudo" e do botão de lixeira |

---

## Implementação

### 1. `src/main.ts` — novos IPC handlers (após linha 696)

```ts
ipcMain.handle('clear-all-report-data', () => {
  saveAccountData({ dailyHistory: [], sessionWindows: [], currentSessionWindow: null });
});

ipcMain.handle('delete-session-window', (_event, resetsAt: string) => {
  const data = getAccountData();
  saveAccountData({
    sessionWindows: (data.sessionWindows ?? []).filter(w => w.resetsAt !== resetsAt),
  });
});
```

### 2. `src/preload.ts` — expor bridges (após linha 113)

```ts
clearAllReportData: (): Promise<void> => ipcRenderer.invoke('clear-all-report-data'),
deleteSessionWindow: (resetsAt: string): Promise<void> => ipcRenderer.invoke('delete-session-window', resetsAt),
```

### 3. `src/renderer/app.ts`

**a) Botão "Limpar tudo" no header do modal**

Injetado dinamicamente dentro de `openReportModal()` (sem alterar HTML estático):

```ts
const isPtBR = currentLang === 'pt-BR'; // já existe na função
const headerEl = modal.querySelector('.day-detail-header')!;
if (!headerEl.querySelector('#btn-clear-report')) {
  const clearBtn = document.createElement('button');
  clearBtn.id = 'btn-clear-report';
  clearBtn.className = 'report-clear-btn';
  clearBtn.textContent = isPtBR ? 'Limpar tudo' : 'Clear all';
  clearBtn.onclick = async () => {
    const msg = isPtBR
      ? 'Apagar todo o histórico e janelas de sessão? Essa ação não pode ser desfeita.'
      : 'Delete all history and session windows? This cannot be undone.';
    if (!confirm(msg)) return;
    await window.claudeUsage.clearAllReportData();
    await openReportModal(); // re-render completo com dados zerados
  };
  headerEl.insertBefore(clearBtn, headerEl.querySelector('#btn-close-report'));
}
```

**b) Ícone de lixeira em cada linha de janela fechada**

Na função `buildRow()`, adicionar botão somente quando `!isOpen`:

```ts
const deleteBtn = !isOpen
  ? `<button class="window-delete-btn" data-resets-at="${resetsAt}" title="${isPtBR ? 'Remover' : 'Remove'}">🗑</button>`
  : '';

return `<div class="report-window-row">
  <span class="report-window-label">${label} ${badge}</span>
  <span class="report-window-date">${rangeStr}</span>
  <span class="report-window-peak" style="color:${color}">${pct}%${peakTimeHtml}</span>
  ${deleteBtn}
</div>`;
```

Após montar `windowsEl.innerHTML`, registrar os handlers:

```ts
windowsEl.querySelectorAll<HTMLButtonElement>('.window-delete-btn').forEach(btn => {
  btn.onclick = async () => {
    await window.claudeUsage.deleteSessionWindow(btn.dataset.resetsAt!);
    await openReportModal(); // re-render completo: gráfico + stats + janelas + analytics
  };
});
```

> **Re-render completo:** chamar `openReportModal()` busca dados frescos via IPC e reconstrói tudo — gráfico, cards (dias monitorados, pico, média, janelas), lista de janelas e analytics (avg/dia, pico comum, streak). Os cálculos são refeitos na hora da exclusão.

### 4. `src/renderer/styles.css` — novos estilos (após `.report-window-peak`)

```css
.report-clear-btn {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: transparent;
  color: #ef4444;
  cursor: pointer;
  margin-right: 8px;
}
.report-clear-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

.window-delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
  opacity: 0.4;
  transition: opacity 0.15s;
  flex-shrink: 0;
}
.window-delete-btn:hover {
  opacity: 1;
}
```

---

## Verificação

1. `npm run build` — compilação limpa sem erros TS
2. `npm run dev` — abrir modal de relatório
3. Botão "Limpar tudo" aparece no header ao lado do ✕
4. Clicar "Limpar tudo" → confirm → modal re-renderiza zerado (gráfico vazio, stats em 0, lista vazia)
5. Cada janela FECHADA tem ícone de lixeira; janela ABERTA não tem
6. Clicar lixeira → janela removida, gráfico/stats/analytics recalculados imediatamente
7. `npm test`
