# Chore: Remover dead code — components/modais/ e components/modals/

**Status:** Em progresso
**Branch:** `chore/remove-dead-code-components`

---

## Objetivo

Remover o diretório `src/renderer/components/modais/` (10 arquivos) e `src/renderer/components/modals/` (pasta vazia) que são dead code — nunca foram importados ou invocados em qualquer lugar do codebase.

---

## Evidência de Dead Code

| Verificação | Resultado |
|-------------|----------|
| Imports em `.ts` | Zero |
| Imports em `.js` | Zero |
| `injectAllModals()` chamada | Nunca — só definida |
| Testes que referenciam | Nenhum |
| IDs duplicados com `index.html` | Nenhum |

---

## Arquivos a remover

| Caminho | Arquivos |
|---------|----------|
| `src/renderer/components/modais/` | 10 arquivos (day-curve-popup.js, force-refresh-modal.js, credential-modal.js, day-detail-modal.js, report-modal.js, edit-snapshot-modal.js, cost-modal.js, smart-scheduler-modal.js, settings-modal.js, index.js) |
| `src/renderer/components/modals/` | 0 arquivos (pasta vazia) |

---

## Planos afetados a atualizar

| Plano | O que muda |
|-------|-----------|
| `minimax-planos/fix-day-curve-duplicado-html.md` | Remover menção a `injectAllModals()` |
| `claude-code-planos/day-curve-popup-resize.md` | Remover menção a `day-curve-popup.js` (nunca implementado) |

---

## Ações

1. `git checkout -b chore/remove-dead-code-components`
2. `rm -rf src/renderer/components/modais/`
3. `rm -rf src/renderer/components/modals/`
4. Atualizar planos mencionados
5. `npm run build` — build limpo
6. `npm test` — 387 testes
7. `git add . && git commit`
8. `git push -u origin chore/remove-dead-code-components`
9. Criar PR + merge

---

## Riscos

| Risco | Nível |
|-------|-------|
| Algum import não encontrado | Baixo — pesquisado exaustivamente |
| Build quebra | Baixo — zero imports |
| Reverter | Simples — git checkout |

---

## Progresso

- [x] Analisar código morto
- [x] Verificar imports em todo o codebase
- [x] Verificar testes
- [x] Identificar planos afetados
- [x] Criar branch
- [x] Remover pastas
- [x] Atualizar planos afetados
- [x] Build + testes
- [ ] Commit + push
- [ ] PR + merge