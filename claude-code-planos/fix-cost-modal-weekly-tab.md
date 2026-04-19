# fix: aba Semanal não exibe conteúdo no modal de custo

## Status: CONCLUÍDO

## Contexto

O modal de custo possui 3 abas: Sessão, Semanal e Mensal. A aba Semanal não exibe conteúdo ao ser clicada — o painel permanece oculto.

## Causa Raiz

**Conflito entre CSS e JavaScript no controle de visibilidade dos painéis.**

O CSS usa a classe `active` para mostrar/esconder os painéis (`styles.css:1944`):
```css
.cost-pane { display: none; }
.cost-pane.active { display: block; }
```

O JavaScript usa a classe `hidden` para o mesmo propósito (`app.ts:2734`):
```javascript
document.querySelectorAll('.cost-pane').forEach(p => p.classList.add('hidden'));
document.getElementById(`cost-${tabId}`)!.classList.remove('hidden');
```

**Resultado**: ao clicar em "Semanal" ou "Mensal", o painel não recebe `active` → permanece `display: none`. A aba Sessão fica presa visível porque `cost-session` nunca perde o `active`.

## Arquivo a modificar

- `src/renderer/app.ts` — linhas 2731–2739

## Fix

```javascript
document.querySelectorAll<HTMLElement>('.cost-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = (btn as HTMLElement).dataset.costTab!;
    document.querySelectorAll('.cost-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.cost-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`cost-${tabId}`)!.classList.add('active');
  });
});
```

## Verificação

1. `npm run build` — build limpo
2. `npm run dev` — abrir app
3. Clicar em "Custo Estimado" → modal abre na aba Sessão
4. Clicar em "Semanal" → painel semanal aparece com valores calculados
5. Clicar em "Mensal" → painel mensal aparece com gauge e valores
6. Voltar para "Sessão" → painel sessão volta normalmente
