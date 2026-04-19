# /analise-consumo — Análise de Consumo Claude

Analisa o JSON exportado do Claude Usage Monitor e gera relatório detalhado com correlação de commits.

> Use para: entender picos de consumo de sessão/semanal em um dia específico

---

## Instrução de execução

Quando o usuário chamar este comando com um JSON (objeto com chave de data contendo array de `{ts, session, weekly}`):

### 1. Identificar data e fuso horário

- Extrair a data da chave do JSON (ex: `"2026-04-18"`)
- Calcular o epoch base: `<data>T00:00:00Z` em milissegundos
- Converter todos os `ts` para **horário BRT (UTC-3)**:
  ```
  horaBRT = (ts - epochBase) / 3_600_000 - 3
  ```

### 2. Identificar blocos de atividade

Detectar:
- **Início de sessão**: primeiro ponto onde `session > 0` após `session == 0`
- **Pico**: valor máximo de `session` no bloco
- **Platô**: sequência com mesmo valor de `session`
- **Reset**: queda brusca para 0 (janela de 5h expirou)

### 3. Calcular métricas de cada bloco

- **Duração da rampa**: tempo do início até o pico
- **Taxa de consumo**: `pico / duração_minutos` em %/min
- **Duração do platô**: tempo estagnado no pico
- **Commits no período**: `git log --format="%ai %s"` filtrando o intervalo BRT

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

1. **Resumo executivo** (3-4 linhas)
2. **Timeline BRT** (tabela por bloco com commits correlacionados)
3. **Métricas** (taxa de consumo, duração da rampa, impacto semanal)
4. **Diagnóstico das causas**
5. **Observações técnicas** sobre o monitor (polling, janela de sessão)

Se pedido para salvar: `claude-code-planos/analise-consumo-<data>.md`
