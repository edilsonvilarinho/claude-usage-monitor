# /analise-consumo — Análise de Consumo Claude

Analisa o JSON exportado do Claude Usage Monitor e gera relatório detalhado com correlação de commits.

> Use para: entender picos de consumo de sessão/semanal em um dia específico

**Quando usar:**
- "Por que meu consumo foi alto nesse dia?" → `/analise-consumo <json>`
- "Qual sessão consumiu mais?" → `/analise-consumo <json>`
- "Quando exatamente o pico aconteceu?" → `/analise-consumo <json>`

---

## Instrução de execução

Quando o usuário chamar este comando com um JSON (objeto com chave de data contendo array de `{ts, session, weekly}`):

### 1. Identificar data e fuso horário

- Extrair a data da chave do JSON (ex: `"2026-04-18"`)
- Calcular o epoch base: `2026-04-18T00:00:00Z` em milissegundos
- Converter todos os `ts` para **horário BRT (UTC-3)**:
  ```
  horaBRT = (ts - epochBase) / 3_600_000 - 3
  ```
- Formatar como `HH:MM`

### 2. Identificar blocos de atividade

Percorrer o array e detectar:
- **Início de sessão**: primeiro ponto onde `session > 0` após `session == 0`
- **Pico**: valor máximo de `session` no bloco
- **Platô**: sequência de pontos com mesmo valor de `session` (polling regular sem atividade nova)
- **Reset**: queda brusca de `session` para 0 (janela de 5h expirou)

### 3. Calcular métricas de cada bloco

Para cada bloco:
- **Duração da rampa**: tempo do início até o pico
- **Taxa de consumo**: `pico / duração_minutos` em %/min
- **Duração do platô**: quanto tempo ficou estagnado no pico
- **Commits no período**: rodar `git log --format="%ai %s"` filtrando o intervalo BRT do bloco

### 4. Correlacionar com commits git

```bash
git log --format="%ai %s" --after="<data>T<horaInicio>-03:00" --before="<data>T<horaFim>-03:00"
```

Montar tabela cruzada: `Horário BRT | Sessão% | Semanal% | Commit associado`

### 5. Analisar impacto semanal

- Mostrar evolução do `weekly` ao longo do dia
- Calcular total consumido no dia vs média esperada (100%/7 ≈ 14%/dia)
- Identificar quais blocos causaram mais impacto

### 6. Gerar diagnóstico

Responder:
- Por que o consumo foi alto? (intensidade de commits, múltiplos bugs, densidade de contexto)
- O comportamento do monitor está correto? (platô, polling, reset da janela)
- Há consumo "fantasma" (sem commits correspondentes)?

### 7. Output esperado

Gerar análise com as seções:
1. **Resumo executivo** (3-4 linhas)
2. **Timeline BRT** (tabela por bloco com commits correlacionados)
3. **Métricas** (taxa de consumo, duração da rampa, impacto semanal)
4. **Diagnóstico das causas**
5. **Observações técnicas** sobre o monitor (polling, janela de sessão)

### 8. Salvar análise (opcional)

Se o usuário pedir para salvar:
```
claude-code-planos/analise-consumo-<data>.md
```

---

**Exemplo de input:**
```
/analise-consumo
{
  "2026-04-18": [
    {"ts": 1776547115564, "session": 0, "weekly": 0},
    {"ts": 1776550231304, "session": 6, "weekly": 1},
    ...
  ]
}
```

**Exemplo de output:**
```
## Resumo — 2026-04-18

2 blocos de atividade: 19:10→22:00 BRT e 22:05→23:06 BRT.
Pico da sessão: 94% (bloco 1) e 89% (bloco 2).
Taxa: ~1,73%/min no bloco 1 (88% em 51 min).
Impacto semanal: 21% em 1 dia (média esperada: 14%).

[tabela de timeline com commits...]
```
