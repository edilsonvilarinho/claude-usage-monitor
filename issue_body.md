## Problema

Quando o usuario clica em "Tentar novamente" no modal de erro (credenciais ou force refresh), nao ha indicacao visual de que a requisicao foi iniciada (spinner/loading).

## Comportamento esperado

- Ao clicar em "Tentar novamente", o botao deve mostrar loading (spinner ou texto "Tentando...")
- O botao deve ser desabilitado durante a requisicao

## Reproducao

1. Abrir modal de credenciais (401 error)
2. Clicar em "Tentar novamente"
3. Nao ha feedback visual de requisicao em andamento