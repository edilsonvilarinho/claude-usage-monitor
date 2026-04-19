# Plano: Padronizar modais de btn-clear-history e btn-backup-history

## Contexto

Os botões `btn-clear-history` e `btn-backup-history` usam diálogos nativos do browser (`confirm()` e `alert()`), enquanto o restante do app usa modais customizados com `.modal-overlay` + `.modal-box`. Isso causa inconsistência visual e quebra o padrão de UX estabelecido.

**Problema:**
- `btn-clear-history` → `confirm()` nativo (linha ~2262, app.ts)
- `btn-backup-history` → `alert()` nativo (linha ~2269, app.ts)

**Padrão existente:**
- `showConfirm(msg, okLabel, cancelLabel): Promise<boolean>` — função reutilizável (linha ~1988, app.ts) — usa `generic-confirm-modal`
- `generic-confirm-modal` — HTML em index.html (linha ~148)

---

## Abordagem

### 1. btn-clear-history → usar `showConfirm()`

**Antes (app.ts ~2261):**
```typescript
document.getElementById('btn-clear-history')!.addEventListener('click', async () => {
  if (!confirm(tr().clearHistoryConfirm)) return;
  await window.claudeUsage.clearDailyHistory();
  if (lastWeeklyResetsAt) renderDailyChart([], lastWeeklyResetsAt);
});
```

**Depois:**
```typescript
document.getElementById('btn-clear-history')!.addEventListener('click', async () => {
  const t = tr();
  const ok = await showConfirm(t.clearHistoryConfirm, t.confirmOk ?? 'Limpar', t.confirmCancel ?? 'Cancelar');
  if (!ok) return;
  await window.claudeUsage.clearDailyHistory();
  if (lastWeeklyResetsAt) renderDailyChart([], lastWeeklyResetsAt);
});
```

---

### 2. Criar helper `showInfo()` reutilizável

Adicionar ao `app.ts`, próximo à `showConfirm()`:

```typescript
function showInfo(msg: string, okLabel: string): Promise<void> {
  return new Promise(resolve => {
    const modal = document.getElementById('generic-confirm-modal')!;
    document.getElementById('generic-confirm-msg')!.textContent = msg;
    const okBtn = document.getElementById('generic-confirm-ok') as HTMLButtonElement;
    const cancelBtn = document.getElementById('generic-confirm-cancel') as HTMLButtonElement;
    okBtn.textContent = okLabel;
    cancelBtn.style.display = 'none';
    modal.classList.remove('hidden');
    const cleanup = () => {
      modal.classList.add('hidden');
      okBtn.onclick = null;
      modal.onclick = null;
      cancelBtn.style.display = '';
      resolve();
    };
    okBtn.onclick = cleanup;
    modal.onclick = (e) => { if (e.target === modal) cleanup(); };
  });
}
```

### 3. btn-backup-history → usar `showInfo()`

**Antes (app.ts ~2267):**
```typescript
document.getElementById('btn-backup-history')!.addEventListener('click', async () => {
  const filepath = await window.claudeUsage.backupWeeklyData();
  alert(tr().backupSuccess(filepath));
});
```

**Depois:**
```typescript
document.getElementById('btn-backup-history')!.addEventListener('click', async () => {
  const t = tr();
  const filepath = await window.claudeUsage.backupWeeklyData();
  await showInfo(t.backupSuccess(filepath), t.confirmOk ?? 'OK');
});
```

---

## Arquivos a modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/renderer/app.ts` | Substituir `confirm()`/`alert()` pelos helpers; adicionar `showInfo()` próximo à `showConfirm()` |

Nenhuma mudança em HTML ou CSS necessária — o `generic-confirm-modal` já existe e suporta o padrão.

---

## Verificação

1. `npm run build` — sem erros TS
2. `npm run dev` — testar botão "Limpar": deve exibir modal customizado, clicar OK limpa, clicar Cancelar ou backdrop fecha sem ação
3. Testar botão "Backup": deve exibir modal customizado com caminho do arquivo, clicar OK ou backdrop fecha
4. Confirmar que botão Cancelar não aparece no modal de backup (apenas OK)

## Status
- [ ] Implementar
