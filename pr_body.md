## Resumo

Implementa funcionalidade de **custo estimado** baseado no uso de tokens, exibindo o consumo em diferentes períodos.

## O que foi implementado

### Novo serviço: `costService.ts`
- Cálculo de custo usando rates da API Anthropic (estimativa)
- Suporte a 3 modelos: Sonnet, Haiku, Opus
- Períodos: Session (5h), Weekly (7d), Monthly

### Modal de Custo
- 3 abas: Session | Weekly | Monthly
- Gauge de orçamento mensal com cores (verde < 50%, amarelo 50-80%, vermelho > 80%)
- Campo configurável para orçamento mensal (default $50)
- Breakdown input/output por período

### UI
- Novo botão 💰 no header (ao lado de ⚙)
- Modal com design consistente aos existentes
- Traduções EN e PT-BR

### Settings
- `monthlyBudget` - orçamento mensal (default: $50)
- `costModel` - modelo para cálculo (default: sonnet)

## Observação

A API `/api/oauth/usage` retorna apenas **utilization (%)**, não tokens brutos. O custo é uma **estimativa** baseada na conversão de % para tokens aproximados. Um aviso é exibido indicando que planos Team/Enterprise podem ter taxas diferentes.

## Fecha

Closes #92
