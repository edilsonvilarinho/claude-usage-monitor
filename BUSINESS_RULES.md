# Business Rules — Claude Usage Monitor
> Única Fonte da Verdade para a lógica de domínio da aplicação.
> Sincronizado com o código-fonte em `src/`. Versão: v8.x

---

## Índice

1. [Módulo de Credenciais e Autenticação](#1-módulo-de-credenciais-e-autenticação)
2. [Módulo de Coleta e Monitoramento (Polling)](#2-módulo-de-coleta-e-monitoramento-polling)
3. [Módulo de Gestão de Cota (Usage Logic)](#3-módulo-de-gestão-de-cota-usage-logic)
4. [Módulo de Notificações](#4-módulo-de-notificações)
5. [Módulo Smart Scheduler (Gestão Preditiva)](#5-módulo-smart-scheduler-gestão-preditiva)
6. [Módulo de Persistência e Backup](#6-módulo-de-persistência-e-backup)
7. [Módulo de Sincronização em Nuvem (Cloud Sync)](#7-módulo-de-sincronização-em-nuvem-cloud-sync)
8. [Módulo de Interface e UX](#8-módulo-de-interface-e-ux)
9. [Arquitetura Reativa (IPC & Eventos)](#9-arquitetura-reativa-ipc--eventos)

---

## 1. Módulo de Credenciais e Autenticação

**Arquivo:** `src/services/credentialService.ts`

### Source of Truth das credenciais

O sistema nunca solicita API key ao usuário. As credenciais são lidas diretamente do arquivo gerado pela CLI do Claude:

```
~/.claude/.credentials.json   ← caminho primário (Windows/Mac/Linux)
\\wsl.localhost\<distro>\home\<user>\.claude\.credentials.json  ← fallback WSL
```

**Por que ler o arquivo diretamente, não usar a CLI?** A CLI do Claude não expõe dados de uso via comando — apenas faz requisições. Ler o arquivo JSON é a única forma de obter o `accessToken` sem intervenção do usuário.

**Regra de seleção quando múltiplos arquivos existem:** O sistema usa o arquivo com o `mtime` (tempo de modificação) mais recente. Isso garante que, se o usuário tem um ambiente Windows nativo + WSL com contas diferentes, o token mais recentemente utilizado — portanto mais provável de estar válido — seja o escolhido.

### Renovação proativa do token

```
margem = 5 minutos antes da expiração
se (token.expiresAt - agora) < 5min → renovar antes de usar
```

**Por que 5 minutos?** Latência de rede + overhead de serialização. Usar um token expirado resultaria em 401 e uma requisição desperdiçada. A margem garante que o token seja renovado antes da próxima chamada à API de uso.

**Comportamento em falha de renovação:** O sistema tenta renovar, mas se falhar (ex.: sem internet), usa o token existente mesmo que próximo do vencimento. A autenticação falha silenciosamente no nível do pollingService, que trata o erro como erro transitório com backoff exponencial.

### Fluxo OAuth

```
credentials.json → refreshToken → POST /v1/oauth/token → novo accessToken + expiresAt
```

O `refreshToken` é persistido de volta no `credentials.json` após cada renovação bem-sucedida (alguns fluxos OAuth emitem novo refresh token a cada renovação).

---

## 2. Módulo de Coleta e Monitoramento (Polling)

**Arquivo:** `src/services/pollingService.ts`

### Intervalos adaptativos

O sistema não usa intervalo fixo. A frequência de coleta é determinada por uma hierarquia de estados:

| Prioridade | Condição | Intervalo |
|-----------|----------|-----------|
| 1 (maior) | Rate limited (429) | Determinístico: tempo restante até `rateLimitedUntil` |
| 2 | Erro de rede/5xx | Exponencial: `1min × 2^(errorCount-1)`, cap 20min |
| 3 | Intervalo customizado | Valor definido pelo usuário via `setCustomInterval()` |
| 4 | Sistema ocioso (≥10min) | 30 minutos |
| 5 | Pico de uso detectado | 7 minutos (apenas 1 ciclo) |
| 6 (padrão) | Normal | 10 minutos |

**Por que intervalo ocioso?** O `powerMonitor.getSystemIdleTime()` do Electron detecta quando o usuário não está interagindo com o computador. Se o sistema está ocioso, o desenvolvedor não está gerando consumo — reduzir a frequência para 30min economiza chamadas à API sem perder informação relevante.

**Por que 1 ciclo rápido após spike?** Um aumento de >1% no uso de sessão ou semanal sinaliza que o usuário está em sessão ativa de alto consumo. Um poll adicional a 7min captura a trajetória ascendente rapidamente, garantindo que notificações e o Smart Scheduler reajam antes do próximo poll normal de 10min.

```typescript
// Detecção de spike:
sessionDelta = data.five_hour.utilization - lastData.five_hour.utilization;
weeklyDelta  = data.seven_day.utilization - lastData.seven_day.utilization;
se (sessionDelta > 0.01 || weeklyDelta > 0.01) → fastCyclesLeft = 1
```

**`FAST_CYCLES = 1`:** Apenas um ciclo rápido — o suficiente para confirmar a tendência sem criar uma espiral de polls frequentes.

### Tratamento de erros por categoria

**429 (Rate Limit):** Nunca é retentado pela `usageApiService`. Lança imediatamente com `{isRateLimit: true}`. O `pollingService` lê os headers `anthropic-ratelimit-*-reset` ou `Retry-After` para determinar o tempo exato de espera. Se a API não fornecer nenhuma dica, aplica backoff exponencial: `5min × 2^(rateLimitCount-1)`, cap 10min.

**5xx (Erro de servidor):** A `usageApiService` retenta até 3 vezes com backoff exponencial interno (`1s × 2^attempt`, cap 16s). Se todas as tentativas falharem, o `pollingService` aplica backoff próprio adicional.

**401 (Autenticação):** Na primeira ocorrência dentro de uma sessão de tentativas, invalida o cache de versão do Claude e recolhe o token. Na segunda, lança o erro para o `pollingService` tratar como erro genérico.

**Persistência do rate limit entre restarts:** O `rateLimitedUntil` e `rateLimitCount` são salvos no electron-store. No startup do app, `main.ts` chama `pollingService.restoreRateLimit(until, count)` antes de `start()` — garantindo que o backoff não seja perdido se o usuário reiniciar o app enquanto ainda está em cooldown.

### `triggerNow()` vs `forceNow()`

| Método | Comportamento se rate limited |
|--------|------------------------------|
| `triggerNow()` | No-op — respeita o cooldown |
| `forceNow()` | Limpa o estado de rate limit e executa |

`forceNow()` é reservado para ações explícitas do usuário (ex.: botão "Atualizar agora" no settings), onde o desenvolvedor conscientemente opta por tentar mesmo dentro do cooldown.

---

## 3. Módulo de Gestão de Cota (Usage Logic)

**Arquivos:** `src/models/usageData.ts`, `src/services/dailySnapshotService.ts`

### Janelas de uso da Anthropic

A API retorna dois contadores independentes:

| Campo | Janela | Reset |
|-------|--------|-------|
| `five_hour` | Sessão (5 horas) | 5h após o primeiro uso da sessão |
| `seven_day` | Semanal (7 dias) | 7 dias após o início do ciclo semanal |

**`utilization`** é um float que pode ultrapassar 1.0 (ex.: `16.0` = 1600% em planos com boost). A UI mostra no máximo 100% no gauge e exibe `>1600%` como texto. O tray exibe `!!!` quando acima de 100%.

**Por que o campo é float e não inteiro?** A API envia `utilization` como proporção (0.0 a n.0). O sistema multiplica por 100 internamente para trabalhar em percentuais inteiros, usando `Math.round()` para todas as persistências — eliminando ruído de ponto flutuante nos históricos.

### Detecção de reset de sessão

O reset é detectado comparando o `resets_at` da API com o valor persistido localmente:

```typescript
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

sessionResetOccurred = (newResetsAtMs - storedResetsAtMs) >= 30min
```

**Por que 30 minutos como limiar, não apenas "diferente"?** O timestamp `resets_at` pode variar por alguns segundos entre polls (arredondamentos da API). Um limiar de 30min elimina falsos positivos de micro-variações enquanto captura com segurança qualquer reset genuíno — o menor ciclo possível é 5 horas.

**Vantagem sobre comparação de `utilization`:** A abordagem por timestamp funciona mesmo após restart do app. A detecção anterior dependia de `prevData` em memória — se o app reiniciasse após um reset mas antes do próximo poll, o reset nunca seria detectado.

### Acumulação de janelas diárias

Cada dia no `dailyHistory` mantém:

```typescript
interface DailySnapshot {
  date: string;            // 'YYYY-MM-DD' (timezone local)
  maxWeekly: number;       // maior % semanal observado no dia
  maxSession: number;      // pico da janela atual/última
  sessionWindowCount: number; // quantas janelas de 5h iniciaram hoje
  sessionAccum: number;    // soma dos picos das janelas COMPLETADAS (excl. atual)
}
```

**Por que usar pico (`peak`) e não o último valor da janela?** O último valor polled pode ser baixo se o reset aconteceu pouco antes do poll. O pico rastreado ao longo da janela é a métrica honesta de "quanto foi consumido nesta sessão".

**`sessionAccum`:** Soma apenas janelas *completadas*. A janela em curso é excluída para evitar dupla contagem — ela já está refletida no `maxSession`. Ao computar métricas de "uso total do dia", o cálculo correto é `sessionAccum + maxSession`.

### Campo `peakTs` — rastreamento temporal do pico

`SessionWindowRecord` e `CurrentSessionWindow` possuem o campo opcional `peakTs?: number` (unix ms) que registra o instante exato em que o pico de utilização foi observado.

**Regras de rastreamento:**
- **Primeiro poll da janela** (`!currentWindow`): `peakTs = now`
- **Mesma janela, novo valor maior** (`sessionPctInt > currentWindow.peak`): `peakTs = now`
- **Mesma janela, valor menor ou igual** (pico não mudou): `peakTs` preservado
- **Após reset** (nova janela): `peakTs = undefined` — nova janela ainda não tem pico registrado
- **Ao completar a janela** (`completedWindow`): herda `peakTs` da `currentWindow`

**Por que opcional?** Compatibilidade com janelas históricas persistidas antes da introdução do campo. `peakTs === undefined` é tratado graciosamente na UI (exibe `—` ou omite).

**Passo `now`:** `updateDailySnapshot` aceita `now: number = Date.now()` como parâmetro, permitindo injeção nos testes.

**Retenção:** O `dailyHistory` mantém no máximo 8 dias. Entradas além desse limite são removidas das mais antigas. Isso garante que a série temporal não cresça indefinidamente no electron-store local.

**Fronteira de meia-noite:** Se uma janela de 5h começa num dia e termina no seguinte (ex.: começou às 22h, resetou às 03h), o pico é atribuído ao dia em que a janela *começou*, não ao dia do reset. O campo `currentWindow.date` armazena o dia de início para esse caso.

### Burn Rate e Previsão de Esgotamento

Calculado no renderer (`updateBurnRate()`) após cada `onUsageUpdated`. Usa os últimos 3 pontos da série temporal do dia corrente.

**Fórmula:**
```
burnRate   = (newest.session - oldest.session) / deltaHours   [%/h]
hoursLeft  = (100 - currentSession) / burnRate
estTime    = newest.ts + hoursLeft * 3_600_000
```

**Condições de supressão** (resultado ocultado):
- Menos de 2 pontos na série do dia
- Sessão atual < 5% (sem uso relevante)
- `deltaHours <= 0` (pontos no mesmo instante)
- `burnRate <= 0` (uso decrescendo)
- `hoursLeft > 6` (muito longe para ser útil)

Exibição: `↑ X.X%/h · esgota ~HH:MM` (pt-BR) ou `↑ X.X%/h · exhausts ~HH:MM` (en), na linha abaixo do gauge de sessão.

### Popup de Curva Diária

Ao clicar em uma coluna do gráfico Ciclo Semanal, abre um popup flutuante inline (`#day-curve-popup`) com um mini gráfico de linha da série temporal do dia clicado. Clicar novamente na mesma coluna fecha o popup (toggle). Fechado automaticamente ao esconder a janela (`visibilitychange`).

### Resumo Analítico (Painel de Janelas)

Exibido no final do modal de Relatório de Uso (`#report-analytics`), calculado sobre as janelas recentes mais a janela corrente:

| Métrica | Cálculo |
|---------|---------|
| Janelas/dia | Média de janelas por dia único no histórico de janelas |
| Pico comum | Hora do dia com maior frequência de `peakTs` (bucket de 1h) |
| Dias >80% | Streak contínuo de dias com `maxSession >= 80` (do mais recente para o mais antigo) |

---

## 4. Módulo de Notificações

**Arquivo:** `src/services/notificationService.ts`

### Lógica de debounce por estado

O sistema usa flags de estado (`sessionNotified`, `weeklyNotified`) para evitar spam de notificações. O ciclo completo é:

```
uso sobe acima do threshold → notifica + seta flag = true
uso cai abaixo de resetThreshold → apaga flag = false (arm reset)
uso sobe novamente → notifica novamente (porque flag = false)
```

**Por que dois thresholds diferentes (`sessionThreshold` vs `resetThreshold`)?** O limiar de disparo (padrão: 80%) e o limiar de rearme (padrão: 50%) são separados intencionalmente. Se fossem iguais, qualquer oscilação em torno de 80% geraria múltiplas notificações. A diferença de 30pp cria uma "zona de silêncio" — o usuário precisa realmente liberar uso antes de ser notificado novamente.

### Detecção de reset de janela temporal

```typescript
isSignificantReset(prevAt, newAt, minGapMs):
  (new Date(newAt) - new Date(prevAt)) > minGapMs
```

Limiar para sessão: **1 hora**. Limiar para semanal: **24 horas**. O mesmo princípio do módulo de uso: evitar falsos positivos de variação de timestamp da API.

Quando o reset é detectado: notifica o usuário (se `notifyOnWindowReset = true`) e rearma o flag de threshold, permitindo que a nova janela dispare alertas do zero.

---

## 5. Módulo Smart Scheduler (Gestão Preditiva)

**Arquivo:** `src/services/smartScheduleService.ts`

### Conceito

Transição de monitoramento *passivo* (ler dados) para *preditivo* (raciocinar sobre onde o reset cairá no dia de trabalho). O objetivo é alinhar o reset da sessão com períodos de pausa natural, eliminando bloqueios durante tarefas de alto foco.

### Variáveis derivadas (base de todos os cálculos)

```
minutosAtuais  = hora * 60 + minuto  (0-1439)
minutosParaReset = max(0, floor((resetsAt - agora) / 60000))
momentoDoReset   = minutosAtuais + minutosParaReset
resetCrossesDay  = momentoDoReset > workEndMin
```

**`Math.floor` nos minutos para reset:** Arredondamento conservador — nunca subestima a urgência. 44,9 min reporta como 44 min, ativando RED se aplicável.

**`momentoDoReset` pode ultrapassar 1.440:** Um dia tem 1.440 minutos. Se `momentoDoReset = 1500`, o reset ocorrerá às 01h do dia seguinte. O sistema detecta isso via `resetCrossesDay` e usa `% (24 * 60)` apenas na exibição de hora.

### Matriz de Decisão Semafórica (cascata de prioridade)

As condições são avaliadas em ordem. A **primeira** satisfeita retorna — as demais não são avaliadas.

---

#### STATUS AZUL — Modo Livre `#3b82f6` (Prioridade 1)

```
!enabled
OR !activeDays.includes(diaAtual)   // dia não útil
OR minutosAtuais < workStartMin      // antes do expediente
OR minutosAtuais > workEndMin        // após o expediente
```

**Intenção:** Fora do contexto de trabalho, cálculos preditivos não têm valor. Suspender o processamento preserva recursos e evita falsos alertas. `activeDays` usa `Date.getDay()` — `0 = Dom`, `1 = Seg`, ..., `6 = Sáb`.

---

#### STATUS ROXO — Otimizador Pré-Sessão `#a855f7` (Prioridade 2)

```
usoSessao === 0   (sessão ainda não iniciada, dentro do expediente)
```

**Cálculo do horário ideal:**
```
idealMin = max(workStartMin, breakStartMin - 300)
idealH   = floor(idealMin / 60) % 24
idealM   = idealMin % 60
```

**Por que `breakStartMin - 300`?** A sessão dura 5 horas = 300 minutos. Iniciar exatamente 5h antes do almoço faz o reset coincidir com o início do intervalo — o usuário termina o período da manhã com tokens zerados e retorna do almoço com sessão fresca.

**Por que `max(workStartMin, ...)`?** Garante que o horário sugerido não seja anterior ao início do expediente. Se o almoço é às 12h (breakStartMin = 720), `720 - 300 = 420 = 07h`. Mas o trabalho começa às 09h (540 min), então o ideal é 09h.

**`% 24` na hora:** Protege contra edge cases onde `idealMin >= 1440` (agendas atípicas) — a hora exibida nunca ultrapassa 23h.

---

#### STATUS VERDE — Margem Segura `#22c55e` (Prioridade 3)

```
usoSessao <= 50
OR (momentoDoReset >= breakStartMin AND momentoDoReset <= breakEndMin)
```

**Intenção:** Dois cenários independentemente seguros: uso baixo (metade da sessão livre) ou reset alinhado com o intervalo (problema se resolve sozinho). O segundo caso é o cenário *ideal* que o status ROXO tenta produzir proativamente.

---

#### STATUS VERMELHO — Risco de Bloqueio `#ef4444` (Prioridade 4)

```
usoSessao >= 85
AND minutosParaReset > 45
AND momentoDoReset < workEndMin
```

**Três critérios obrigatórios:**
- **≥85%:** Poucos tokens restantes — tarefas longas falharão.
- **>45 min para reset:** Tempo real de trabalho em risco (não é imediato).
- **Reset antes do fim do expediente:** O bloqueio ocorrerá durante horas produtivas.

**Por que RED antes de YELLOW (prioridade 4 > 5)?** RED é condição mais restrita — se não for avaliado antes, um caso RED seria capturado pelo fallback YELLOW.

---

#### STATUS AMARELO — Alerta de Colisão `#eab308` (Prioridade 5 — fallback)

Qualquer situação dentro do expediente que não seja verde nem vermelha. Uso moderado com reset previsto durante horas produtivas. Sinal para intercalar tarefas manuais e economizar tokens para demandas futuras.

---

### Eixo Dinâmico da Timeline

```typescript
timelineStartMin = min(workStartMin, minutosAtuais)
timelineEndMin   = max(workEndMin, minutosAtuais, resetCrossesDay ? workEndMin : momentoDoReset)
totalRange       = timelineEndMin - timelineStartMin
pctOf(min)       = clamp((min - timelineStartMin) / totalRange * 100, 0, 100)
```

**Expansão para `minutosAtuais`:** Se o usuário abre o modal antes do expediente (ex.: 08h), o marcador "Agora" ficaria fora da barra. A expansão para a esquerda garante visibilidade.

**Expansão para `momentoDoReset`:** Se o reset ocorre após o fim do expediente, a expansão para a direita mantém o evento mais relevante na tela.

**Exceção `resetCrossesDay`:** Reset após meia-noite teria `momentoDoReset > 1440`, distorcendo a escala da barra. Nesses casos, o eixo para em `workEndMin` e o reset é indicado textualmente com `(+1d)`.

**Ancoragem dos labels `workStart/End`:** Os rótulos de início e fim de expediente são renderizados em seus `%` absolutos mesmo com o eixo expandido. Isso preserva o contexto do usuário — independente de onde "Agora" ou o reset estejam, o desenvolvedor sempre sabe visualmente onde começa e termina seu dia.

---

## 6. Módulo de Persistência e Backup

**Arquivos:** `src/services/settingsService.ts`, `src/main.ts`

### Stores separados por responsabilidade

| Store (arquivo) | Conteúdo | Localização |
|----------------|----------|-------------|
| `config.json` | Configurações da app (tema, notificações, workSchedule) | `%APPDATA%\Claude Usage Monitor\` |
| `accounts.json` | Histórico de uso por conta (email) | `%APPDATA%\Claude Usage Monitor\` |
| `cloud-sync.json` | JWT do cloud sync (criptografado) | `%APPDATA%\Claude Usage Monitor\` |
| `sync-outbox.json` | Operações pendentes de push | `%APPDATA%\Claude Usage Monitor\` |

**Por que separar configurações de dados históricos?** Permite resetar histórico sem afetar preferências do usuário, e vice-versa. Também facilita a migração de dados entre contas — ao detectar uma nova conta de email, o sistema migra os dados legados do `config.json` para `accounts.json[email]` automaticamente.

### Regra de migração de conta

```
nova conta detectada (email novo no accounts.json)
  → copia dados legados do config.json (usageHistory, dailyHistory, rateLimits)
  → remove dados legados do config.json
  → remove placeholder 'default' se existia
```

Isso garante que um usuário que nunca configurou multi-conta não perca seu histórico ao fazer login pela primeira vez com email identificado.

### Auto Backup

O auto backup é controlado por `autoBackupMode` com 4 valores:

| Modo | Comportamento |
|------|---------------|
| `never` | Sem backup automático |
| `before` | Salva `auto-backup.json` antes de cada poll (`before-poll`) |
| `after` | Salva `auto-backup.json` após cada atualização bem-sucedida |
| `always` | Salva antes E após cada poll |

**Por que `before` é uma opção válida?** Permite capturar o estado *anterior* a qualquer modificação que um poll possa causar (ex.: o poll detecta um reset e modifica o dailyHistory). Em caso de bug que corrompa dados, a versão `before` é o ponto de restauração mais seguro.

**Localização padrão:** `%APPDATA%\Claude Usage Monitor\backups\auto-backup.json` — arquivo único sobrescrito a cada ciclo. Não é versionado intencionalmente para evitar acúmulo de disco.

### Backup Manual (Weekly Backup)

Backup com timestamp — `bk_DD_MM_YYYY_HH_mm.json`. Mantém apenas os **últimos 8 arquivos** no diretório de backups. Arquivos além desse limite são excluídos dos mais antigos.

**Por que 8?** Janela de 7 dias do uso semanal + 1 margem. Garante que o usuário possa recuperar dados de qualquer ponto dos últimos 7 dias com um backup por dia.

### Conteúdo do export/backup

```json
{
  "exportedAt": "ISO datetime",
  "dailyHistory": [...],
  "timeSeries": {...},
  "sessionWindows": [...]
}
```

**O `workSchedule` deve estar no export.** IAs externas que recebem o JSON de export precisam dos parâmetros de agenda para reproduzir os cálculos do Smart Scheduler e planejar o dia do usuário com os mesmos critérios. Um export sem `workSchedule` fornece dados de consumo sem contexto temporal — equivale a um extrato bancário sem datas.

### Regra crítica do electron-store schema

> **Nunca reduza `minimum`/`maximum` de campos numéricos existentes sem uma migration.**

O electron-store valida os dados persistidos contra o schema ao iniciar. Se um campo persistido violar o novo schema (ex.: valor 120 com `maximum: 100`), o app crasha na inicialização. Adicionar validação mais restrita exige uma migration que normalize os dados existentes antes de aplicar o novo schema.

---

## 7. Módulo de Sincronização em Nuvem (Cloud Sync)

**Arquivo:** `src/services/syncService.ts`

### Fluxo de autenticação

```
accessToken (Anthropic OAuth)
  → POST /auth/exchange { accessToken, deviceId, deviceLabel }
  → JWT próprio do sync server + expiresAt + email
```

O sistema usa o `accessToken` do Claude como prova de identidade. O servidor de sync emite um JWT próprio — isso desacopla o sync server do OAuth da Anthropic. O JWT é armazenado criptografado no `cloud-sync.json` via electron-store com `encryptionKey`.

**Por que não enviar o `accessToken` diretamente nas requisições de sync?** O `accessToken` da Anthropic tem escopo amplo. Usar um JWT de escopo restrito (apenas sync) minimiza o impacto de qualquer vazamento do store de sync.

### Renovação proativa do JWT

```
se (jwt.expiresAt - agora) < 5min → re-exchange antes de usar
```

Mesma lógica da renovação do `accessToken` do OAuth — evitar 401 mid-sync que interromperia operações.

### Resolução de conflito: Last Write Wins por `updatedAt`

Para **configurações** (`settings`):

```
se (remote.settings.updatedAt > local.settingsUpdatedAt) → aplica settings remotas
senão → mantém settings locais
```

O `settingsUpdatedAt` é um timestamp Unix (ms) atualizado a cada `saveSettings()`. O dispositivo que modificou a configuração mais recentemente vence.

Para **dados históricos** (dailyHistory, timeSeries, sessionWindows, usageHistory):

A lógica de merge é implementada no pacote `@claude-usage/shared` com funções `mergeDailySnapshots`, `mergeSessionWindows`, `mergeTimeSeries`, `mergeUsageHistory`. O princípio é **union por chave** — nenhum dado local é deletado por um pull remoto.

**Por que union e não last-write-wins para histórico?** Histórico é aditivo por natureza — dois dispositivos usam Claude em momentos diferentes. Um merge por union garante que o histórico completo de todos os dispositivos seja preservado, em vez de um dispositivo sobrescrever o outro.

### Outbox: garantia de entrega

Dados a serem enviados são enfileirados no `sync-outbox.json` antes do push. O push é tentado imediatamente após o enqueue. Em caso de falha, o outbox persiste entre restarts — na próxima tentativa de sync (periódica ou manual), o push é retentado.

**Dedup no outbox:** Se já existe um item `op: 'push'` no outbox, não enfileira outro. O payload é sempre reconstruído *fresco* no momento do flush, nunca do payload armazenado — isso garante que um push atrasado envie os dados mais recentes, não uma versão obsoleta de quando foi enfileirado.

### Backoff em erros de sync

Sequência: `1min → 2min → 5min → 10min → 30min` (cada falha avança um passo). O `backoffCount` reseta para 0 após um sync bem-sucedido.

### Falha de autenticação (AUTH_401)

Se o JWT expirar ou for inválido e o re-exchange com a Anthropic também falhar (401), o sync é marcado como `temporarilyDisabled = true`. O sistema não tentará novamente até o usuário re-habilitar manualmente o cloud sync. Isso evita um loop de tentativas de autenticação que poderia gerar rate limit na Anthropic.

---

## 8. Módulo de Interface e UX

**Arquivos:** `src/renderer/app.ts`, `src/renderer/styles.css`

### Internacionalização (i18n)

**Regra:** Nenhuma string visível ao usuário deve ser hardcoded no HTML ou TypeScript do renderer. Todas as strings usam o sistema `data-i18n`:

```html
<span data-i18n="gaugeLabel"></span>
```

```typescript
document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
  const key = el.dataset.i18n as keyof Translations;
  const val = t[key];
  if (typeof val === 'string') el.textContent = val;
});
```

**Por que `data-i18n` no HTML em vez de strings no TypeScript?** O HTML define a estrutura; o TypeScript injeta o conteúdo. Isso permite que strings dinâmicas (ex.: `notifSessionWarnBody(pct, threshold)`) coexistam com strings estáticas sem um sistema de templates separado.

Idiomas suportados: `en` (padrão), `pt-BR`.

### Tema Visual

Temas `dark`, `light` e `system` (segue o SO). Implementado via CSS custom properties (`--bg`, `--text`, etc.) no seletor `body[data-theme]`. A transparência Acrylic do Windows 11 usa `backdrop-filter: blur(24px)` + `backgroundMaterial: 'acrylic'` no `BrowserWindow`.

**Regra:** Cores funcionais (status do gauge, semáforo) devem manter contraste legível em ambos os temas. As cores dos status semafóricos são hexadecimais fixos (definidos no `smartScheduleService.ts`) — independentes do tema — pois são cores de comunicação de estado, não decorativas.

### Gauge e Tray Icon

O gauge é um doughnut Chart.js com `circumference: 180°` (semicírculo). O ícone do tray é desenhado em um `<canvas>` oculto no renderer e enviado como PNG via IPC `tray-icon-data` para o processo principal.

**Por que desenhar no renderer e não no main?** O renderer tem acesso ao Canvas API do browser. O processo principal (Node.js) não tem Canvas nativo — requereria uma dependência extra (`canvas` npm package com binários nativos). Delegar ao renderer mantém o pipeline de build simples.

### Tamanhos de janela

Controlado via `body[data-size]` com CSS vars `--gauge-w`, `--gauge-h`, `--pct-size`. Quatro tamanhos: `normal`, `medium`, `large`, `xlarge`. O renderer não conhece pixels absolutos — apenas os tamanhos semânticos. O mapeamento para dimensões reais está no `main.ts`.

---

## 9. Arquitetura Reativa (IPC & Eventos)

### Fluxo completo de dados

```
Anthropic API
    │  GET /api/oauth/usage (oauth-2025-04-20 beta)
    ▼
usageApiService.fetchUsageData()
    │  UsageData { five_hour, seven_day, extra_usage }
    ▼
pollingService (EventEmitter)
    │
    ├─→ emit('before-poll')       → main.ts: auto backup 'before'/'always'
    │
    ├─→ emit('usage-updated', data)
    │       │
    │       ├─→ main.ts: updateDailySnapshot() → persiste dailyHistory
    │       ├─→ main.ts: checkAndNotify()       → toast notifications
    │       ├─→ main.ts: updateTrayTooltip()    → tray tooltip
    │       ├─→ main.ts: auto backup 'after'/'always'
    │       ├─→ main.ts: syncService.enqueuePush() → cloud sync
    │       └─→ IPC 'usage-updated' → renderer: gauge, gráficos, status
    │
    ├─→ emit('rate-limited', until, count)
    │       └─→ IPC 'rate-limited' → renderer: countdown de cooldown
    │
    └─→ emit('error', err)
            └─→ main.ts: log + IPC 'last-response'
```

### Por que o cálculo do Smart Status é no Main Process?

`computeSmartStatus()` é chamado no main process (não no renderer) por duas razões:

1. **O tray consome o resultado** mesmo com a janela fechada — o ícone e tooltip refletem o status semafórico a qualquer momento.
2. **Unicidade de estado** — se o cálculo fosse no renderer, fechar e reabrir a janela poderia produzir um status diferente do exibido no tray.

### Por que o renderer recebe push, não faz pull?

O renderer não tem acesso direto ao filesystem ou às credenciais — isso é intencional pelo modelo de segurança do Electron (context isolation). Todo dado chega via IPC push do main process. Isso também garante que a UI seja sempre reativa a novos dados sem polling adicional.

### Re-cálculo on-demand na abertura do modal

Ao abrir o modal do Smart Plan, o renderer solicita via IPC `get-smart-status` sem aguardar o próximo poll. O main recalcula usando `now = new Date()` e os últimos dados em memória (`lastUsageData`). Isso garante que a timeline reflita a hora atual do sistema — não a hora do último poll, que pode ter ocorrido 30 minutos antes (modo idle).

---

*Última atualização: 2026-04-12 — gerado a partir de leitura direta do código-fonte em `src/`.*
