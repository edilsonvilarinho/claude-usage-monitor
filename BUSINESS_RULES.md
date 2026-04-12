# Business Rules — Smart Scheduler
> Documento de referência para a lógica de domínio do sistema. Versão sincronizada com o código em `src/services/smartScheduleService.ts`.

---

## 1. O Conceito: Gestão Preditiva de Produtividade

O Claude Usage Monitor nasceu como ferramenta passiva: ler o uso de tokens da API e exibir um gauge. O **Smart Scheduler** representa a evolução para monitoramento ativo — o sistema passa a *raciocinar* sobre o tempo, não apenas sobre o consumo.

### Problema de negócio

O ciclo de sessão da IA Anthropic reseta a cada **5 horas** a partir do primeiro uso. Esse reset pode ocorrer em qualquer momento do dia. Quando acontece durante uma tarefa de alto foco (ex.: revisão de PR, debug complexo), o desenvolvedor fica bloqueado — sem tokens, sem assistência — no pior momento possível.

### Solução: Alinhamento Preditivo

O Smart Scheduler calcula *onde* o reset cairá na timeline do dia útil e classifica a situação em um dos cinco estados semafóricos. O objetivo é duplo:

1. **Minimizar downtime não planejado** — avisar com antecedência para intercalar tarefas manuais antes do bloqueio.
2. **Maximizar aproveitamento do intervalo** — alinhar o reset com a pausa de almoço, transformando uma limitação técnica em pausa produtiva natural.

### Dados de entrada

| Parâmetro | Origem | Descrição |
|-----------|--------|-----------|
| `workSchedule` | `settingsService` (electron-store) | Agenda de trabalho do usuário |
| `usoSessao` | API Anthropic (polling) | Percentual de uso da sessão atual (0–100+) |
| `resetsAtIso` | API Anthropic | Timestamp ISO do próximo reset de sessão |
| `now` | Sistema operacional | Hora atual — injetável para testes |

---

## 2. A Matriz de Decisão Semafórica

A função central é `computeSmartStatus()` em `src/services/smartScheduleService.ts`. As condições são avaliadas em cascata com prioridade explícita — a primeira que satisfazer retorna imediatamente.

### Variáveis derivadas (pré-computadas para todas as decisões)

```
minutosAtuais  = hora_atual * 60 + minuto_atual
minutosParaReset = max(0, floor((resetsAt - now) / 60000))
momentoDoReset = minutosAtuais + minutosParaReset
resetCrossesDay = momentoDoReset > workEndMin
```

**Por que usar minutos inteiros?** Elimina ambiguidade de fuso horário e simplifica comparações de posição na timeline. Um dia tem 1.440 minutos; o `momentoDoReset` pode ultrapassar 1.440 caso o reset ocorra após meia-noite — o sistema sinaliza isso com `resetCrossesDay = true`.

**Por que `Math.floor` no cálculo de minutos para reset?** Arredondamento para baixo garante que o sistema nunca subestime a urgência. Se restam 44,9 minutos, o sistema reporta 44 — acionando o RED se aplicável.

---

### STATUS AZUL — Modo Livre `#3b82f6`

**Prioridade: 1 (mais alta) — avaliado primeiro**

**Condição (qualquer uma satisfeita):**
```
!schedule.enabled
OR !activeDays.includes(diaAtual)
OR minutosAtuais < workStartMin
OR minutosAtuais > workEndMin
```

**Intenção de negócio:** Quando o Smart Scheduler está desativado, o dia atual não é dia útil, ou o horário está fora do expediente configurado, não há valor em calcular riscos de colisão — o usuário está em modo livre. Suspender os cálculos preditivos preserva ciclos de CPU e evita falsos alertas fora do horário produtivo.

**Nota sobre `activeDays`:** O array usa a convenção `Date.getDay()` do JavaScript — `0 = Domingo`, `1 = Segunda`, ..., `6 = Sábado`. O padrão é `[1, 2, 3, 4, 5]` (segunda a sexta).

---

### STATUS ROXO — Otimizador Pré-Sessão `#a855f7`

**Prioridade: 2**

**Condição:**
```
usoSessao === 0   (sessão ainda não iniciada, mas dentro do expediente)
```

**Cálculo do horário ideal:**
```
idealMin = max(workStartMin, breakStartMin - 300)
idealH   = floor(idealMin / 60) % 24
idealM   = idealMin % 60
```

**Por que `breakStartMin - 300`?** A sessão dura exatamente 5 horas = 300 minutos. Iniciar exatamente 5h antes do almoço garante que o reset ocorra no início do intervalo de almoço — o usuário termina o expediente da manhã com tokens zerados e volta do almoço com sessão fresca.

**Por que `max(workStartMin, ...)`?** Impede sugerir um horário antes do início do expediente. Se o almoço é às 12h, o ideal seria 07h — mas o trabalho começa às 09h, então o sistema sugere 09h.

**Por que `% 24` no cálculo de horas?** Garante que, se `idealMin` ultrapassar 1.440 (edge case de agenda fora do padrão), a hora exibida não ultrapasse 23.

**Intenção de negócio:** O desenvolvedor ainda não começou a usar a IA hoje. Em vez de um alerta genérico, o sistema oferece um *horário estratégico* para iniciar — máxima produtividade, zero colisão prevista.

---

### STATUS VERDE — Margem Segura `#22c55e`

**Prioridade: 3**

**Condição (qualquer uma satisfeita):**
```
usoSessao <= 50
OR (momentoDoReset >= breakStartMin AND momentoDoReset <= breakEndMin)
```

**Intenção de negócio:** Dois cenários seguros distintos:

1. **Uso baixo (≤50%):** Com metade da sessão ainda disponível, qualquer tarefa pode ser iniciada sem risco imediato de bloqueio.
2. **Reset alinhado com almoço:** Independente do percentual de uso, se o reset vai cair dentro da janela de intervalo, a situação é naturalmente resolvida — o usuário vai pausar de qualquer forma.

O segundo caso é o cenário *ideal* que o STATUS ROXO tenta promover proativamente.

---

### STATUS VERMELHO — Risco de Bloqueio `#ef4444`

**Prioridade: 4 — avaliado antes do amarelo**

**Condição (todas devem ser verdadeiras):**
```
usoSessao >= 85
AND minutosParaReset > 45
AND momentoDoReset < workEndMin
```

**Intenção de negócio:** Três critérios combinados descrevem a situação crítica:

- **≥85% de uso:** Restam poucos tokens — tarefas longas ou de alto contexto falharão em breve.
- **>45 minutos para reset:** O reset não está próximo o suficiente para "esperar". Há tempo real de trabalho em risco.
- **Reset antes do fim do expediente:** O bloqueio vai ocorrer durante horas produtivas — não é um problema que se resolverá naturalmente ao fim do dia.

**Por que RED antes de YELLOW?** O vermelho é condição mais restrita e mais urgente. O amarelo é o fallback para qualquer situação que não seja verde nem vermelha — posicioná-lo depois garante que o RED nunca seja "capturado" pelo YELLOW.

---

### STATUS AMARELO — Alerta de Colisão `#eab308`

**Prioridade: 5 (fallback — avaliado por último)**

**Condição:** Nenhum dos estados anteriores foi satisfeito.

**Intenção de negócio:** Zona de atenção. O uso está moderado (>50%), o reset não cairá no almoço, mas também não é crítico o suficiente para VERMELHO. O desenvolvedor deve intercalar tarefas que não dependam da IA — revisões de código manual, documentação, reuniões — para economizar tokens para as horas de alta demanda.

---

## 3. Regras de Integridade e Persistência

### Source of Truth: `workSchedule`

O objeto `workSchedule` armazenado via `electron-store` (`config.json`) é o **dado mestre** do Smart Scheduler. Nenhuma parte do sistema deve derivar ou inferir parâmetros de agenda de outras fontes.

```typescript
interface WorkSchedule {
  enabled: boolean;
  activeDays: number[];   // 0-6, convenção Date.getDay()
  workStart: string;      // "HH:mm" (24h)
  workEnd: string;        // "HH:mm" (24h)
  breakStart: string;     // "HH:mm" (24h)
  breakEnd: string;       // "HH:mm" (24h)
}
```

**Default configurado:** Segunda a sexta, 09h–18h, intervalo 12h–13h.

### Regras de Exportação

O `workSchedule` **deve** ser incluído em qualquer exportação de dados do sistema. Motivo: IAs externas (ex.: Claude, GPT) que recebem um export de uso histórico precisam dos mesmos parâmetros de agenda para reproduzir os cálculos do Smart Scheduler e planejar o dia do usuário com base nos mesmos critérios.

Um export sem `workSchedule` fornece dados de consumo sem contexto temporal — equivale a um extrato bancário sem as datas.

### Validação de Fronteira do Intervalo

O sistema não deve permitir salvar uma agenda onde o intervalo (`break`) não esteja **contido dentro** do expediente (`work`):

```
Válido:   workStart <= breakStart < breakEnd <= workEnd
Inválido: breakStart < workStart  (intervalo começa antes do expediente)
Inválido: breakEnd > workEnd      (intervalo termina após o expediente)
```

Salvar uma agenda inválida faz com que a condição GREEN de "reset alinhado com almoço" nunca seja satisfeita — o `momentoDoReset` jamais estará dentro de um intervalo fora do expediente.

---

## 4. Regras de Visualização e Dataviz

### Eixo Dinâmico (Dynamic Bounds)

A timeline do Smart Plan não tem eixo fixo. Os limites são calculados a cada render:

```typescript
timelineStartMin = min(workStartMin, minutosAtuais)
timelineEndMin   = max(workEndMin, minutosAtuais, resetCrossesDay ? workEndMin : momentoDoReset)
totalRange       = timelineEndMin - timelineStartMin
pctOf(min)       = clamp((min - timelineStartMin) / totalRange * 100, 0, 100)
```

**Por que expandir para `minutosAtuais`?** Se o usuário abrir o modal antes do início do expediente (ex.: 08h quando o trabalho começa às 09h), o marcador "Agora" ficaria fora da barra — invisível. A expansão para a esquerda garante que o contexto atual sempre apareça.

**Por que expandir para `momentoDoReset`?** Se o reset ocorrerá após o fim do expediente (ex.: 19h quando o trabalho termina às 18h), o marcador de reset ficaria fora da barra. A expansão para a direita mantém o evento mais relevante (o reset) visível.

**Exceção `resetCrossesDay`:** Quando o reset ultrapassa o limite do dia (ex.: `momentoDoReset = 1500 min = 01h do dia seguinte`), expandir a barra para acomodá-lo produziria uma timeline distorcida. Nesse caso, o eixo para no `workEndMin` e o reset é indicado textualmente com `(+1d)`.

### Ancoragem de Referência: Labels de `workStart`/`workEnd`

Os rótulos dos marcadores de início e fim do expediente são **sempre renderizados**, mesmo quando o eixo se expande além deles. Isso preserva o contexto do usuário: independente de onde "Agora" ou o reset estejam, o desenvolvedor sempre sabe visualmente onde começa e termina seu dia de trabalho.

Sem essa ancoragem, um eixo expandido produziria uma barra sem referência — o usuário teria que recalcular mentalmente as proporções para entender se o reset é antes ou depois do horário de trabalho.

```typescript
// Labels permanecem nos seus % absolutos mesmo com eixo expandido
tlStart.style.left = `${pctOf(workStartMin)}%`;
tlEnd.style.left   = `${pctOf(workEndMin)}%`;
```

### Precisão de Marcadores: Hora Exata Obrigatória

Todo marcador dinâmico na timeline (Agora, Reset, WorkStart, WorkEnd) deve exibir a hora exata em formato `HH:mm` diretamente abaixo do tick. Isso elimina estimativas visuais — o usuário não deve precisar interpretar a posição proporcional para descobrir "aproximadamente que horas é o reset".

O `momentoDoReset` pode ultrapassar 1.440 minutos (meia-noite). A exibição usa módulo:
```typescript
resetHHMM = formatMinutes(momentoDoReset % (24 * 60))
```
Isso converte, por exemplo, `momentoDoReset = 1140 + 420 = 1560 min` → `1560 % 1440 = 120 min` → `02:00`.

---

## 5. Arquitetura Reativa (IPC & Eventos)

### Fluxo de dados

```
┌─────────────────────┐
│  Anthropic API      │  GET /api/oauth/usage
└────────┬────────────┘
         │ JSON: { utilization, resetsAt, ... }
         ▼
┌─────────────────────┐
│  usageApiService    │  Retorna UsageData normalizado
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  pollingService     │  Intervalo adaptativo (7–30min)
│                     │  Chama computeSmartStatus() com
│                     │  workSchedule + usoSessao + resetsAt
└────────┬────────────┘
         │ IPC: 'usage-updated' (payload inclui SmartStatus)
         ▼
┌─────────────────────┐
│  Main Process       │  Atualiza tray tooltip e ícone
└────────┬────────────┘
         │ IPC push para BrowserWindow
         ▼
┌─────────────────────┐
│  Renderer (app.ts)  │  Renderiza gauge, status semafórico
│                     │  e timeline do Smart Plan
└─────────────────────┘
```

### Por que o cálculo é feito no Main Process?

O `computeSmartStatus()` é executado no processo principal (não no renderer) porque:

1. **O tray também consome o resultado** — o ícone e tooltip do system tray precisam refletir o status semafórico mesmo com a janela fechada.
2. **Único ponto de verdade** — se o cálculo fosse no renderer, abrir e fechar a janela poderia produzir estados inconsistentes entre tray e UI.

### Por que o cálculo é reativo ao polling, mas sob demanda no modal?

O Smart Status é recalculado a cada ciclo do `pollingService` — quando há novos dados da API. Isso garante que o tray reflita a situação mais recente.

Porém, ao **abrir o modal** do Smart Plan, o renderer solicita o estado atual via IPC (`get-smart-status`) sem aguardar o próximo poll. Esse padrão on-demand existe porque o usuário pode abrir o modal a qualquer momento entre dois polls — possivelmente com o status desatualizado por até 30 minutos (modo idle). Forçar um recálculo imediato na abertura garante que a timeline exibida sempre reflita a hora atual do sistema, não a hora do último poll.

---

*Última atualização: 2026-04-12 — gerado a partir de `src/services/smartScheduleService.ts` e `src/renderer/app.ts`.*
