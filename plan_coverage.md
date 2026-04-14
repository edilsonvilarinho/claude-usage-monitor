## Objetivo

Atingir 90% de coverage em branches (atualmente em 80.13%).

## Análise

### Coverage atual
- Statements: 92.8%
- **Branches: 80.13%** (threshold: 80%)
- Functions: 87.16%
- Lines: 95.61%

### Arquivos com menor cobertura

| Arquivo | Branches |
|---------|----------|
| syncService.ts | 63.03% |
| pollingService.ts | 74.54% |
| jwt.ts | 75% |

### Problema

syncService.ts tem muitos métodos privados que não podem ser testados diretamente:
- `syncNow()` - não exportado
- `enqueuePush()` - não exportado  
- `enqueuePull()` - não exportado
- `handlePush()` - não exportado
- `handlePull()` - não exportado
- `mergeWithRemote()` - não exportado
- many error handlers

### Opções para atingir 90%

1. **Refatorar syncService** - Expor métodos privados para teste (trabalho: alto)
2. **Adicionar testes para pollingService** - Já tem 31 testes, mas coverage é 74.54%
3. **Mockar menos** - Testar mais casos reais
4. **Reducao de threshold** - Mudar para 75% (não recomendado)

### Recomendação

Refatorar syncService para expor métodos de teste usando padrão `_internal()` ou criar `SyncServiceInternal` para testes.

### Estimativa

- Refatoração syncService: ~2-3 horas
- Testes adicionais pollingService: ~1 hora
- Total: ~4 horas para atingir 90%

---