---
name: test-workflow
description: Usar quando executar testes ou criar PRs — inclui checklist pré-commit e screenshot workflow.
trigger: "*.test.ts"
---

## Test Workflow Skill

Quando trabalhando com arquivos de teste ou preparando PRs:

### Checklist Pré-Teste

```bash
npm run build
npm test
```

**NÃO prosseguir se build ou testes falharem.**

### Coverage Report

```bash
npm run test:coverage
# Abre coverage/ no navegador
```

### Screenshot Workflow (Mudanças UI)

1. **Antes de implementar:**
   - Pedir screenshot do estado atual
   - Salvar como referência

2. **Após implementar:**
   - Pedir screenshot do resultado
   - Comparar antes/depois

3. **Antes de merge:**
   - Confirmar que usuário aprovou o resultado visual
   - Apenas fazer merge após aprovação

### Testes Unitários

- Framework: **vitest**
- Localização: `src/**/__tests__/`
- Cobertura: `credentialService`, `notificationService`, `pollingService`, `settingsService`, `startupService`, `updateService`, `usageApiService`, `i18n/mainTranslations`

### Testar Single File

```bash
vitest run src/services/__tests__/pollingService.test.ts
```

### Regras

1. **NUNCA** commitar se testes falharem
2. **NUNCA** fazer merge se usuário não aprovou screenshot (mudanças UI)
3. **SEMPRE** verificar build limpo antes de testes
4. **DETERMINISTIC ONLY** — sem chamadas de rede reais, sem timers reais sem mock

### Edge Cases para Testar

- `utilization > 1.0`
- missing credentials
- 429 during startup
- WSL environment
- system idle
- Rate limit persistente entre sessões