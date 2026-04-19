# feat: exibir regras de cálculo no modal de custo estimado (Sessão, Semanal, Mensal)

## Status: CONCLUÍDO

## Contexto

O modal de custo estimado exibia apenas os valores finais ($X.XX) sem explicar como foram calculados. O usuário solicitou que cada aba (Sessão 5h, Semanal, Mensal) mostrasse a fórmula e os parâmetros usados no cálculo, para dar transparência ao processo de estimativa.

## Problemas identificados na análise

1. **Bug: Opus `tokensPerPercent = 10.000` estava incorreto**
   - A 100% de utilização opus = ~$0,45 vs $9,00 no sonnet — completamente invertido economicamente
   - Opus é 5× mais caro por token que sonnet, então deveria ter ~5× menos tokens de quota
   - Corrigido para 200.000 (proporcional: sonnet=1M, haiku=4M, opus=200K)

2. **Inconsistência BUSINESS_RULES vs código**
   - BUSINESS_RULES dizia `× 4.3` para o multiplicador mensal
   - Código usava `30/7 ≈ 4.286`
   - BUSINESS_RULES atualizado para refletir o valor exato `30/7`

3. **Split 50/50 input/output não era visível ao usuário**
   - Hardcoded no `estimateTokensFromPercent`, sem nenhuma indicação na UI

## Arquivos modificados

| Arquivo | O que mudou |
|---------|------------|
| `src/services/costService.ts` | Corrige opus (10k→200k); adiciona `inputTokens`/`outputTokens` ao `CostBreakdown`; adiciona `sessionPct`, `weeklyPct`, `modelRates` ao `CostEstimate` |
| `src/renderer/index.html` | Adiciona seção `.cost-formula` em cada aba com elementos de fórmula |
| `src/renderer/app.ts` | Popula os elementos de fórmula em `loadCostData`; adiciona traduções en/pt-BR |
| `src/renderer/styles.css` | Adiciona estilos para `.cost-formula`, `.cost-formula-title`, `.cost-formula-row`, `.cost-formula-note` |
| `BUSINESS_RULES.md` | Atualiza seção 8 com tabela de tokens por modelo e fórmulas corretas |

## O que cada aba exibe agora

### Sessão (5h)
- Uso 5h: X%
- Modelo: [modelo] · taxa: $X/M in · $Y/M out
- Tokens est.: X in + Y out
- Distribuição assumida: 50% input / 50% output

### Semanal (7d)
- Uso 7d: X%
- Modelo: [modelo] · taxa: $X/M in · $Y/M out
- Tokens est.: X in + Y out
- Base: uso 7d × limite sessão × 7 · split 50/50

### Mensal
- Projeção: base semanal × 4,3 (30 ÷ 7 semanas/mês)
- Tokens est.: X in + Y out

## Fórmula de tokens por modelo

| Modelo | Tokens em 100% | Justificativa |
|--------|---------------|---------------|
| Haiku | 4.000.000 | Modelo mais barato — quota maior |
| Sonnet | 1.000.000 | Referência base |
| Opus | 200.000 | 5× menos que sonnet (modelo mais caro) |

## Verificação

1. `npm run build` — exit 0 ✓
2. `npm test` — 387 testes passando ✓
3. Abrir modal de custo → cada aba exibe seção "Como foi calculado" com valores dinâmicos
4. Trocar modelo em Settings → seção atualiza taxas e tokens corretamente
5. Verificar bilíngue: en mostra "How it was calculated", pt-BR mostra "Como foi calculado"

## Commit

`86d1ed7` — feat: adicionar seção de fórmula no modal de custo estimado
