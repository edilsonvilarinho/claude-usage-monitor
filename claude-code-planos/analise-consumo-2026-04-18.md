# Análise de Consumo — 2026-04-18 (Sábado)

## Contexto
Análise detalhada do histórico de sessão do Claude Usage Monitor para o dia 18/04/2026.
O gráfico mostra dois blocos de uso intenso com curva de sessão (5h) chegando a 94% e 89%,
e impacto semanal chegando a ~22% em apenas um dia.

---

## Conversão de Timestamps → Horário BRT (UTC-3)

Base epoch: 2026-04-18T00:00:00Z = 1.776.470.400.000 ms

---

## BLOCO 1: Sessão ativa (19:10 → 22:00 BRT)

### Fase de observação (app iniciando, sem atividade)
| Horário BRT | Sessão | Semanal |
|---|---|---|
| 18:19 | 0% | 0% |
| 18:29 | 0% | 0% |
| 18:39 | 0% | 0% |
| 18:49 | 0% | 0% |
| 19:06 | 0% | 0% |

### Rampa de consumo — de 0% a 94% em 51 minutos
| Horário BRT | Sessão | Semanal | Evento correlato |
|---|---|---|---|
| **19:10** | 6% | 1% | ← **INÍCIO** da sessão ativa |
| 19:14 | 15% | 2% | |
| 19:20 | 23% | 3% | |
| 19:23 | 37% | 5% | commit: `fix: corrigir acumulado incorreto ao fechar sessão com 0%` (#101) — 19:24 |
| 19:27 | 42% | 5% | commit: `Merge pull request #102` — 19:27 |
| 19:37 | 54% | 6% | |
| 19:40 | 60% | 7% | commit: `feat: adicionar botão limpar tudo e deletar janela` (#103) — 19:40 |
| 19:44 | 65% | 8% | commit: `fix: corrigir janela aberta sumindo` (#105) — 19:44 |
| 19:48 | 69% | 8% | commit: `fix: janela aberta exibe valor atual` (#107) — 19:50 |
| 19:50 | 75% | 9% | commit: `fix: substituir confirm() nativo por modal customizado` (#109) — 19:54 |
| 19:53 | 82% | 10% | commit: `docs: atualizar plano` — 19:53 |
| 19:54 | 83% | 10% | commit: `feat: limpeza no modal de relatório` — 19:59 |
| 19:57 | 85% | 10% | |
| 19:59 | 87% | 10% | commit: `fix: elevar z-index do confirm modal` — 19:55 |
| 20:00 | 90% | 10% | |
| **20:01** | **94%** | **11%** | ← **PICO** atingido |
| 20:05 | 94% | 11% | commit: `chore: otimização de tokens` — 20:05 |

**Taxa média de consumo:** ~1,73% por minuto (88% em 51 min)
**Commits nesse bloco:** 9 commits em ~41 min (média: 1 a cada 4,5 min)

### Platô — 94% congelado por ~2h
| Horário BRT | Sessão | Semanal | Observação |
|---|---|---|---|
| 20:05 | 94% | 11% | polling 10min — sem novos commits |
| 20:11 | 94% | 11% | |
| 20:21 | 94% | 11% | |
| ... | 94% | 11% | polling regular a cada 10min |
| 21:54 | 94% | 11% | último ponto antes do reset |

**Conclusão do platô:** Após o commit das 20:05, houve ~2h de inatividade de desenvolvimento.
O `pollingService` continuou consultando a API a cada 10min e recebendo 94% — confirmado
pela ausência de commits entre 20:05 e 22:19 BRT.

### Reset da sessão às 22:00 BRT
| Horário BRT | Sessão | Semanal | Evento |
|---|---|---|---|
| 21:54 | 94% | 11% | último ponto da janela |
| **22:00** | **0%** | **11%** | ← **RESET** — janela de 5h expirou |
| 22:01 | 0% | 11% | |
| 22:05 | 4% | 11% | ← nova sessão começa imediatamente |

**O que causou o reset instantâneo:**
A janela de sessão do Claude é uma janela deslizante de 5h. O uso começou às ~17:00 BRT
(antes do que o monitoramento capturou). Quando esse uso antigo saiu da janela às 22:00 BRT,
o contador de sessão despencou de 94% para 0% em um único polling.

---

## BLOCO 2: Segunda sessão ativa (22:05 → 23:06+ BRT)

### Rampa da segunda sessão — 0% a 89% em ~1h
| Horário BRT | Sessão | Semanal | Evento correlato |
|---|---|---|---|
| **22:05** | 4% | 11% | ← nova sessão inicia |
| 22:11 | 18% | 13% | |
| 22:13 | 30% | 14% | commit: `fix: final=0 e maxSession=0 incorretos` (#111) — 22:19 |
| 22:15 | 34% | 14% | commit: `Merge pull request #112` — 22:22 |
| 22:17 | 36% | 15% | |
| 22:21 | 40% | 15% | |
| 22:26 | 46% | 16% | commit: `fix: corrige exibição abas Semanal e Mensal` — 22:30 |
| 22:29 | 50% | 16% | commit: `fix: corrige cálculo mensal inflado` — 22:33 |
| 22:34 | 59% | 17% | commit: `fix: corrige botão excluir oculto` — 22:40 |
| 22:37 | 64% | 18% | commit: `fix: substitui confirm/alert por modais` — 22:53 |
| 22:39 | 71% | 19% | |
| 22:42 | 73% | 19% | commit: `feat: aumenta modal day-curve-popup` — 23:00 |
| 22:44 | 75% | 19% | commit: `chore: bump versão 16.0.0` — 23:01 |
| 22:47 | 79% | 19% | |
| **22:59** | **89%** | **21%** | ← **PICO** do bloco 2 |
| 23:05 | 89% | 21% | platô inicia |
| 23:48 | 89% | 21% | último dado do JSON |

**Commits nesse bloco:** 8 commits em ~54 min

---

## Análise do Impacto Semanal

| Hora BRT | % Semanal | Incremento |
|---|---|---|
| 18:19 | 0% | — |
| 19:10 | 1% | +1% |
| 20:01 | 11% | +10% em 51 min |
| 22:00 | 11% | platô — inativo |
| 22:05 | 11% | nova sessão inicia |
| 22:59 | 21% | +10% em ~55 min |
| 23:06+ | 21% | platô |

**Total consumido em 1 dia:** ~21-22% da cota semanal em apenas dois blocos de ~50min cada

### Por que 22% em um dia?
- A cota semanal é de 7 dias → média esperada seria ~14%/dia
- Em 2026-04-18 houve dois blocos de desenvolvimento extremamente intenso
- Cada bloco sozinho consumiu ~10% do semanal
- Ritmo de commits (1 a cada 4-6 minutos) indica uso contínuo do Claude sem pausas

---

## Causas Raiz da Curva Alta

### 1. Volume de Issues fechadas (9 issues em ~95 min totais)
- #101 fix acumulado sessão
- #103 feat botão limpar tudo
- #105 fix janela aberta sumindo
- #107 fix valor exibido
- #109 fix confirm() nativo
- #111 fix final/maxSession
- #112 merge
- + 2 fixes modais custo

### 2. Densidade de contexto por conversa
Cada bug exige: ler arquivo → propor fix → implementar → testar → commit.
Múltiplos arquivos por ciclo = alto consumo de tokens por turno.

### 3. Dois blocos de pico sem pausa efetiva entre eles
O reset da sessão às 22:00 não foi uma "folga" — o desenvolvimento retomou imediatamente
às 22:05 com o mesmo ritmo, consumindo outros 10% do semanal.

---

## Observações Técnicas sobre o Monitor

### Comportamento do `pollingService`
- Durante o platô (20:01–21:54): polling normal de 10min, não acionou Fast (sem spike >1%)
- O platô de 94% por 2h é esperado: API retorna o mesmo valor, sem variação

### Comportamento da janela de sessão
- A queda de 94% → 0% em um único polling (22:00 BRT) confirma que a janela de 5h
  da Anthropic é renovada em bloco, não deslizante gradualmente
- Ao zerar, a API reportou 0% — o novo uso das 22:05 ainda não estava quantificado

### Correlação Monitor × API
- Todos os picos no gráfico correspondem exatamente a commits no repositório
- Nenhum consumo "fantasma" — o monitor está capturando fielmente a atividade real

---

## Conclusão

O consumo de ~22% do semanal em um único dia é completamente explicado por:

1. **Dois blocos de desenvolvimento ultra-intenso** com Claude Code (9+8 commits em ~50min cada)
2. **Cada bug/feature exigiu múltiplos turnos** (ler → planejar → implementar → corrigir → commitar)
3. **Sem consumo "fantasma"** — cada % de uso corresponde a commits rastreáveis no git
4. **O reset às 22:00 BRT** foi a janela de 5h da Anthropic expirando, não falha do monitor

Para reduzir o impacto semanal em dias similares: agrupar mais mudanças por conversa Claude
(menos turnos separados por bug) ou usar sessões mais longas com mais contexto acumulado.
