# fix: Modal Sessões CLI fecha ao clicar em item da lista

## Dados

| Campo | Valor |
|-------|-------|
| **Branch** | `fix/cli-sessions-modal-close-on-click#133` |
| **Status** | ✅ Concluído |
| **Issue** | #133 |
| **Commit** | 48df0c4 |

## Problema

Ao clicar em um item da lista de Sessões CLI, o modal fecha imediatamente em vez de exibir os detalhes.

## Root Cause

Em `AppBootstrap.ts:53-59`, existe um listener global de click no `document` que fecha qualquer modal quando o clique não é em um elemento interativo (button/input/select/textarea). Como `.cli-session-row` é uma `div`, não passa no filtro e o modal fecha.

## Fix

Adicionar `e.stopPropagation()` no handler de clique da `.cli-session-row` em `CliSessionsModal.ts:134-138`.

## Progresso

- [x] Analisar problema
- [x] Criar branch
- [x] Criar/anotar plano
- [x] Implementar fix
- [x] Build + testes
- [x] Commit + push