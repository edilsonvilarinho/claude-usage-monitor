# Plano de Testes Playwright — Claude Usage Monitor
> Baseado em BUSINESS_RULES.md v8.x · Criado em 2026-04-20

## Status: ✅ Fase 1 Concluída — 17/17 testes smoke passando
> Implementado em 2026-04-20 via claude-code

### Decisão arquitetural crítica
`contextBridge.exposeInMainWorld` cria propriedades `non-configurable, non-writable` — impossível sobrescrever via `addInitScript`. Solução: `preload-test.ts` dedicado, ativado quando `NODE_ENV=test` no `main.ts`.

---

## Visão Geral

### Objetivo
Criar uma suíte de testes E2E com Playwright que cubra os fluxos críticos do frontend Electron,
mapeando diretamente as regras de negócio do BUSINESS_RULES.md.

### Escopo
- Testes E2E via `@playwright/test` com `electron.launch()`
- Mock de `window.claudeUsage` (IPC bridge do preload)
- Foco em fluxos de UI visíveis ao usuário
- Complementa os 369 testes unitários Vitest já existentes

### O que NÃO cobre
- Lógica de serviços (já coberta por Vitest)
- Processos internos do main.ts
- Comunicação com a API real da Anthropic

---

## Configuração Técnica

### Dependências
```bash
npm install -D @playwright/test
npx playwright install chromium  # apenas chromium é necessário para Electron
```

### Arquitetura do Mock IPC

O `window.claudeUsage` é injetado pelo preload.ts em tempo de execução.
Para testes, precisamos substituí-lo antes do DOMContentLoaded.

**Estratégia:**
```typescript
// e2e/helpers/electron.ts
import { _electron as electron } from '@playwright/test';
import path from 'path';

export async function launchApp() {
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main.js')],
    env: { ...process.env, NODE_ENV: 'test' }
  });
  const page = await app.firstWindow();
  return { app, page };
}
```

**Mock via `page.addInitScript()`** (executa antes do app.ts):
```typescript
await page.addInitScript(() => {
  const handlers: Record<string, Function[]> = {};
  window.claudeUsage = {
    getSettings: async () => ({ theme: 'dark', language: 'en', ... }),
    onUsageUpdated: (cb) => { handlers['usage'] = [cb]; },
    // ... demais métodos mockados
    __trigger: (event, ...args) => handlers[event]?.forEach(cb => cb(...args)),
  };
});
```

### Estrutura de Pastas
```
e2e/
├── playwright.config.ts
├── helpers/
│   ├── electron.ts          # launch() + waitForReady()
│   └── ipc-mock.ts          # Factory de mocks por cenário
├── fixtures/
│   ├── usage-data.ts        # UsageData para diferentes cenários
│   ├── daily-history.ts     # DailySnapshot[] mocks
│   └── settings.ts          # AppSettings defaults
└── tests/
    ├── 01-dashboard.spec.ts
    ├── 02-header.spec.ts
    ├── 03-banners.spec.ts
    ├── 04-modals/
    │   ├── credential.spec.ts
    │   ├── settings.spec.ts
    │   ├── day-detail.spec.ts
    │   ├── cost.spec.ts
    │   ├── smart-plan.spec.ts
    │   └── report.spec.ts
    ├── 05-history.spec.ts
    ├── 06-i18n.spec.ts
    ├── 07-smart-scheduler.spec.ts
    └── 08-notifications.spec.ts
```

---

## Suite 01 — Dashboard Principal
> Módulo: §3 Gestão de Cota (Usage Logic)

### Dados de entrada (fixture `usage-data.ts`)
```typescript
export const NORMAL_USAGE: UsageData = {
  five_hour: { utilization: 0.45, resets_at: '2026-04-20T15:00:00Z' },
  seven_day: { utilization: 0.72, resets_at: '2026-04-27T00:00:00Z' },
};

export const OVER_100_USAGE: UsageData = {
  five_hour: { utilization: 16.0, resets_at: '...' },   // 1600%
  seven_day: { utilization: 1.05, resets_at: '...' },   // 105%
};

export const NEAR_RESET_USAGE: UsageData = {
  five_hour: { utilization: 0.98 },
  seven_day: { utilization: 0.35 },
};
```

### Cenários

#### TC-01.1 — Gauge de sessão renderiza percentual correto
**Regra:** BR §3 — `utilization` é float 0–n, UI multiplica ×100 com `Math.round()`
```
Dado: onUsageUpdated({ five_hour.utilization: 0.45 })
Quando: gauge de sessão for renderizado
Então: #pct-session exibe "45%"
  E: canvas #gauge-session está presente no DOM
```

#### TC-01.2 — Gauge semanal renderiza percentual correto
```
Dado: onUsageUpdated({ seven_day.utilization: 0.72 })
Quando: gauge semanal for renderizado
Então: #pct-weekly exibe "72%"
```

#### TC-01.3 — Utilização > 100%: exibe texto ">1600%" e gauge trava em 100%
**Regra:** BR §3 — "UI caps gauge at 100%, displays >1600%. Tray shows !!! above 100%"
```
Dado: onUsageUpdated({ five_hour.utilization: 16.0 })
Quando: gauge de sessão for renderizado
Então: #pct-session exibe ">1600%"
  E: canvas do gauge não ultrapassa o arco de 180° (semicírculo cheio)
```

#### TC-01.4 — Exibição de horário de reset
**Regra:** BR §3 — `resets_at` da API → exibido formatado na UI
```
Dado: onUsageUpdated({ five_hour.resets_at: '2026-04-20T15:30:00Z' })
Quando: sessão for renderizada
Então: #reset-session exibe horário formatado (ex: "15:30" ou "3:30 PM")
```

#### TC-01.5 — Burn Rate exibido quando condições atendidas
**Regra:** BR §3 — Burn Rate com ≥2 pontos de série, sessão ≥5%, burnRate >0, hoursLeft ≤6
```
Dado: série temporal com 2+ pontos onde sessão subiu de 20% para 35%
  E: onUsageUpdated({ five_hour.utilization: 0.35 })
Quando: dashboard for atualizado
Então: #burn-rate-line exibe texto no formato "↑ X.X%/h · esgota ~HH:MM"
```

#### TC-01.6 — Burn Rate SUPRIMIDO quando sessão < 5%
**Regra:** BR §3 — "Sessão atual < 5% (sem uso relevante)" → suprime burn rate
```
Dado: onUsageUpdated({ five_hour.utilization: 0.03 })
Quando: dashboard for atualizado
Então: #burn-rate-line está vazio ou oculto
```

#### TC-01.7 — Burn Rate SUPRIMIDO quando hoursLeft > 6
**Regra:** BR §3 — "hoursLeft > 6 (muito longe para ser útil)" → suprime
```
Dado: série temporal com burnRate calculado resultando em hoursLeft = 8
Quando: dashboard for atualizado
Então: #burn-rate-line está vazio ou oculto
```

#### TC-01.8 — Gauge semanal burn rate com data futura
**Regra:** BR §3 — "↑ X.X%/h · esgota ~dom HH:MM" se outro dia (pt-BR)
```
Dado: idioma pt-BR configurado
  E: burnRate semanal com hoursLeft = 30 (outro dia)
Quando: dashboard atualizar
Então: #burn-rate-line-weekly exibe formato com dia da semana abreviado
```

---

## Suite 02 — Header e Navegação
> Módulo: §9 Interface e UX

### Cenários

#### TC-02.1 — Botão configurações abre modal
```
Dado: app inicializado
Quando: usuário clica em #btn-settings
Então: #settings-modal é visível
```

#### TC-02.2 — Botão custo abre modal de custo
```
Dado: app inicializado com dados de uso
Quando: usuário clica em #btn-cost
Então: #cost-modal é visível
```

#### TC-02.3 — Botão fechar envia IPC closeWindow
```
Dado: app inicializado
Quando: usuário clica em #btn-close
Então: window.claudeUsage.closeWindow() foi chamado
```

#### TC-02.4 — Botão Cloud Sync abre painel
```
Dado: cloudSync habilitado nas settings
Quando: usuário clica em #btn-cloud-sync
Então: painel de cloud sync é visível
```

#### TC-02.5 — Status dot reflete estado da conexão
**Regra:** BR §14 — WebSocket status: connecting | connected | disconnected | error
```
Dado: server.onStatusChange emite 'connected'
Quando: header renderizar
Então: #status-dot tem classe CSS correspondente a "connected" (verde)

Dado: server.onStatusChange emite 'disconnected'
Quando: header renderizar
Então: #status-dot tem classe CSS correspondente a "disconnected"
```

---

## Suite 03 — Banners
> Módulo: §4 Notificações, §2 Polling, §12 Atualizações

### Cenários

#### TC-03.1 — Banner de Rate Limit aparece com countdown
**Regra:** BR §2 — "IPC 'rate-limited' → renderer: countdown de cooldown"
```
Dado: onRateLimited(Date.now() + 300000) (5 minutos)
Quando: renderer receber o evento
Então: banner de rate limit está visível
  E: exibe contador regressivo em minutos/segundos
  E: botão "Forçar atualização" está desabilitado
```

#### TC-03.2 — Banner de Rate Limit desaparece após expirar
```
Dado: onRateLimited(Date.now() + 2000) (2 segundos)
Quando: 3 segundos se passarem
Então: banner de rate limit não está mais visível
```

#### TC-03.3 — Banner de atualização minor (azul)
**Regra:** BR §12 — "Minor/patch → Banner azul no popup"
```
Dado: onUpdateAvailable({ version: '1.6.0', isMajor: false })
Quando: renderer receber o evento
Então: banner de update está visível com cor azul
  E: exibe "v1.6.0"
  E: NÃO abre modal automático
```

#### TC-03.4 — Update major abre modal obrigatório
**Regra:** BR §12 — "Major → Banner + modal de aviso"
```
Dado: onUpdateAvailable({ version: '2.0.0', isMajor: true })
Quando: renderer receber o evento
Então: #update-major-modal está visível
  E: exibe "v2.0.0"
```

#### TC-03.5 — Banner de erro exibe mensagem
```
Dado: onError("Falha ao conectar com a API")
Quando: renderer receber o evento
Então: banner de erro está visível
  E: exibe "Falha ao conectar com a API"
```

#### TC-03.6 — Update minor: "Mais tarde" suprime banner (skippedVersion)
**Regra:** BR §6 — "skippedVersion: versão que o usuário optou por pular"
```
Dado: banner de update v1.6.0 visível
Quando: usuário clica em "Mais tarde"
Então: banner desaparece
  E: saveSettings foi chamado com skippedVersion: "1.6.0"
```

---

## Suite 04 — Modal de Credenciais
> Módulo: §1 Credenciais e Autenticação, §13 OAuth PKCE

### Cenários

#### TC-04.1 — Modal abre quando credencial está ausente
**Regra:** BR §1 — "onCredentialMissing → modal de credenciais"
```
Dado: onCredentialMissing('/home/user/.claude/.credentials.json')
Quando: renderer receber o evento
Então: #credential-modal está visível
  E: exibe o caminho do arquivo de credenciais
```

#### TC-04.2 — Modal abre quando credenciais expiram (401)
**Regra:** BR §2 — "401 → main.ts detecta 'Authentication failed (401)' → modal"
```
Dado: onCredentialsExpired()
Quando: renderer receber o evento
Então: #credential-modal está visível
```

#### TC-04.3 — Botão "Login com Claude" inicia OAuth
**Regra:** BR §13 — "startOAuthLogin() → abre navegador em AUTH_URL"
```
Dado: #credential-modal está visível
Quando: usuário clica em botão de OAuth
Então: window.claudeUsage.startOAuthLogin() foi chamado
```

#### TC-04.4 — OAuth bem-sucedido fecha modal
**Regra:** BR §13 — "onOAuthLoginComplete → handleLoginSuccess"
```
Dado: #credential-modal está visível com OAuth em andamento
Quando: onOAuthLoginComplete() é emitido
Então: #credential-modal não está mais visível
```

#### TC-04.5 — OAuth com erro exibe mensagem
**Regra:** BR §13 — "onOAuthLoginError → handleLoginError"
```
Dado: #credential-modal está visível
Quando: onOAuthLoginError("Token exchange failed: timeout")
Então: #credential-modal permanece visível
  E: mensagem de erro "Token exchange failed: timeout" está visível
```

#### TC-04.6 — Credenciais manuais: formulário de entrada
```
Dado: #credential-modal está visível
  E: usuário seleciona aba "Manual"
Quando: usuário preenche os campos de token
  E: clica em salvar
Então: window.claudeUsage.saveManualCredentials() foi chamado com os dados
```

---

## Suite 05 — Modal de Configurações (Settings)
> Módulo: §6 Persistência, §9 Interface e UX

### Cenários

#### TC-05.1 — Modal abre com 5 abas
```
Dado: app inicializado
Quando: usuário clica em #btn-settings
Então: #settings-modal está visível
  E: 5 abas estão presentes: Geral, Exibição, Notificações, Backup, Smart Plan
```

#### TC-05.2 — Trocar tema para Dark
**Regra:** BR §9 — "Temas dark, light e system. Implementado via CSS custom properties"
```
Dado: #settings-modal aberto na aba Geral
Quando: usuário seleciona "Dark" no seletor de tema
  E: clica em salvar
Então: saveSettings foi chamado com { theme: 'dark' }
```

#### TC-05.3 — Trocar idioma para PT-BR
**Regra:** BR §9 — "Idiomas suportados: en (padrão), pt-BR"
```
Dado: #settings-modal aberto na aba Geral
Quando: usuário seleciona "pt-BR" no seletor de idioma
  E: clica em salvar
Então: saveSettings foi chamado com { language: 'pt-BR' }
  E: labels da UI atualizam imediatamente para português
```

#### TC-05.4 — Notificações: threshold de sessão
**Regra:** BR §4 — "sessionThreshold: % para disparar alerta de sessão (padrão: 80)"
```
Dado: #settings-modal na aba Notificações
Quando: usuário altera threshold de sessão para 90
  E: salva
Então: saveSettings chamado com { notifications: { sessionThreshold: 90 } }
```

#### TC-05.5 — Notificações: master switch desabilita tudo
**Regra:** BR §4 — "enabled: master switch — desativa todas as notificações"
```
Dado: #settings-modal na aba Notificações com enabled: true
Quando: usuário desmarca o toggle principal
  E: salva
Então: saveSettings chamado com { notifications: { enabled: false } }
```

#### TC-05.6 — compactMode vs essentialMode
**Regra:** BR §6 — "compactMode: reduz padding; essentialMode: remove seções inteiras"
```
Dado: #settings-modal aberto
Quando: usuário ativa essentialMode
  E: salva
Então: saveSettings chamado com { essentialMode: true }
  E: seção de gráfico diário não está visível na UI
```

#### TC-05.7 — Backup: modo autoBackupMode
**Regra:** BR §6 — autoBackupMode: 'never'|'before'|'after'|'always'
```
Dado: #settings-modal na aba Backup
Quando: usuário seleciona "after"
  E: salva
Então: saveSettings chamado com { autoBackupMode: 'after' }
```

#### TC-05.8 — Backup: escolher pasta
```
Dado: #settings-modal na aba Backup
Quando: usuário clica em "Escolher pasta"
Então: window.claudeUsage.chooseAutoBackupFolder() foi chamado
```

#### TC-05.9 — Settings: pollIntervalMinutes limites (1–60)
**Regra:** BR §6 — "pollIntervalMinutes: number (1–60)"
```
Dado: #settings-modal na aba Geral
Quando: usuário tenta inserir 0 no campo de intervalo de polling
Então: campo não aceita valor abaixo de 1 (validação HTML min=1)

Quando: usuário tenta inserir 61
Então: campo não aceita valor acima de 60 (validação HTML max=60)
```

---

## Suite 06 — Modal de Custo Estimado
> Módulo: §8 Custo Estimado

### Cenários

#### TC-06.1 — Modal exibe 3 abas: Session, Weekly, Monthly
**Regra:** BR §8 — "modal exibe 3 abas: Session, Weekly, Monthly"
```
Dado: app com getCostEstimate retornando dados válidos
Quando: usuário clica em #btn-cost
Então: #cost-modal está visível
  E: abas Session, Weekly, Monthly estão presentes
```

#### TC-06.2 — Aba Monthly: gauge de orçamento verde < 50%
**Regra:** BR §8 — "Verde: < 50% do orçamento"
```
Dado: monthlyBudget: 50
  E: custo estimado mensal: $20 (40%)
Quando: aba Monthly estiver ativa
Então: gauge de orçamento tem cor verde
```

#### TC-06.3 — Aba Monthly: gauge amarelo 50–80%
**Regra:** BR §8 — "Amarelo: 50–80% do orçamento"
```
Dado: monthlyBudget: 50
  E: custo estimado mensal: $30 (60%)
Quando: aba Monthly estiver ativa
Então: gauge de orçamento tem cor amarela
```

#### TC-06.4 — Aba Monthly: gauge vermelho > 80%
**Regra:** BR §8 — "Vermelho: > 80% do orçamento"
```
Dado: monthlyBudget: 50
  E: custo estimado mensal: $45 (90%)
Quando: aba Monthly estiver ativa
Então: gauge de orçamento tem cor vermelha
```

#### TC-06.5 — Trocar modelo de custo muda estimativa
**Regra:** BR §8 — "Opus deve custar ~5× mais que Sonnet com mesma utilização"
```
Dado: #cost-modal aberto com costModel: 'sonnet' e utilização 50%
  E: custo exibido é $X
Quando: usuário muda para costModel: 'opus'
Então: custo exibido é aproximadamente 5× maior que $X
```

#### TC-06.6 — Aviso de estimativa é exibido
**Regra:** BR §8 — "⚠️ Valor estimado baseado na API padrão."
```
Dado: #cost-modal aberto
Então: texto de aviso de estimativa está visível
```

---

## Suite 07 — Modal de Detalhe do Dia
> Módulo: §3 Modal de Histórico Diário

### Cenários

#### TC-07.1 — Clique em coluna do gráfico diário abre modal
**Regra:** BR §3 — "clique em .daily-col DEVE chamar openDayDetailModal. Não substituir por popup inline"
```
Dado: gráfico de barras diárias com dados de ontem
Quando: usuário clica em uma coluna .daily-col
Então: #day-detail-modal está visível
  E: NÃO é um popup inline — é o modal completo
```

#### TC-07.2 — Modal exibe gráfico de linha do dia
```
Dado: getDayTimeSeries retornando 6 pontos para '2026-04-19'
Quando: #day-detail-modal abrir para '2026-04-19'
Então: canvas do gráfico de linha está presente
  E: eixo X contém os horários do dia
```

#### TC-07.3 — Modal fecha com botão X
```
Dado: #day-detail-modal aberto
Quando: usuário clica em #day-detail-close
Então: #day-detail-modal não está mais visível
```

#### TC-07.4 — Modal fecha ao ocultar janela (visibilitychange)
```
Dado: #day-detail-modal aberto
Quando: visibilitychange dispara com document.hidden = true
Então: #day-detail-modal não está mais visível
```

---

## Suite 08 — Painel de Histórico
> Módulo: §3 Acumulação de janelas diárias, §6 Backup

### Cenários

#### TC-08.1 — Seção histórico visível quando showHistory: true
**Regra:** BR §6 — "showHistory: boolean"
```
Dado: getSettings retorna { showHistory: true }
Quando: app inicializar
Então: #history-section está visível
```

#### TC-08.2 — Tabela exibe linhas por dia com dados corretos
```
Dado: getDailyHistory retornando 3 dias de dados
Quando: #history-section renderizar
Então: 3 linhas estão presentes na tabela
  E: cada linha exibe data, maxSession%, maxWeekly%, sessionWindowCount
```

#### TC-08.3 — Clique em linha abre modal de detalhe do dia
```
Dado: tabela de histórico com dados visível
Quando: usuário clica em uma linha
Então: #day-detail-modal abre com os dados do dia clicado
```

#### TC-08.4 — Estado "Aberta" vs "Fechada" da janela de sessão
**Regra:** BR §3 — "isOpen = true E (peak > 0 OU final > 0) → 'Aberta'; caso contrário → 'Fechada'"
```
Dado: janela com isOpen: true, peak: 0, final: 0
Quando: resumo das janelas for exibido
Então: janela aparece como "Fechada" (não "Aberta")
```

#### TC-08.5 — Modal de Relatório: janela aberta exibe peak, fechada exibe final
**Regra:** BR §3 — "Janela aberta: exibe peak; Janela fechada: exibe final"
```
Dado: janela aberta com peak: 73, final: 65
  E: janela fechada com peak: 100, final: 73
Quando: #report-modal exibir as janelas
Então: janela aberta exibe "73%"
  E: janela fechada exibe "73%" (final, não 100%)
```

---

## Suite 09 — Smart Scheduler
> Módulo: §5 Smart Scheduler (Gestão Preditiva)

### Dados de entrada (fixture `smart-plan-scenarios.ts`)
```typescript
// Cenário AZUL: fora do expediente
export const BLUE_OUTSIDE_HOURS = {
  now: '2026-04-20T07:00:00', // antes das 08:00
  workSchedule: { startHour: 8, endHour: 18, breakStart: 12, breakEnd: 13 },
  usage: { five_hour: { utilization: 0.45 } }
};

// Cenário VERDE: uso baixo
export const GREEN_LOW_USAGE = {
  now: '2026-04-20T10:00:00',
  usage: { five_hour: { utilization: 0.30 } } // <= 50%
};

// Cenário VERMELHO: risco de bloqueio
export const RED_BLOCK_RISK = {
  now: '2026-04-20T09:00:00',
  usage: { five_hour: { utilization: 0.90, resets_at: '2026-04-20T11:00:00Z' } }
  // 90% uso, reset em 2h, dentro do expediente
};
```

### Cenários

#### TC-09.1 — Status AZUL fora do expediente
**Regra:** BR §5 — "minutosAtuais < workStartMin → AZUL"
```
Dado: horário atual 07:00, expediente começa às 08:00
Quando: Smart Plan modal abre
Então: indicador semafórico tem cor azul (#3b82f6)
  E: texto indica "Modo Livre"
```

#### TC-09.2 — Status VERDE com uso baixo (≤50%)
**Regra:** BR §5 — "usoSessao <= 50 → VERDE"
```
Dado: horário 10:00 dentro do expediente
  E: usage.five_hour.utilization = 0.30
Quando: Smart Plan modal abre
Então: indicador tem cor verde (#22c55e)
```

#### TC-09.3 — Status VERDE com reset alinhado ao almoço
**Regra:** BR §5 — "momentoDoReset >= breakStartMin AND <= breakEndMin → VERDE"
```
Dado: horário 11:00, almoço 12:00–13:00
  E: reset previsto para 12:30 (dentro do almoço)
  E: usage = 70%
Quando: Smart Plan modal abre
Então: indicador tem cor verde (#22c55e)
```

#### TC-09.4 — Status VERMELHO: risco de bloqueio
**Regra:** BR §5 — "usoSessao >= 85 AND minutosParaReset > 45 AND reset antes do fim do expediente → VERMELHO"
```
Dado: horário 09:00
  E: usage.five_hour.utilization = 0.90 (90%)
  E: reset em 11:00 (2h à frente, >45min, dentro do expediente)
Quando: Smart Plan modal abre
Então: indicador tem cor vermelha (#ef4444)
```

#### TC-09.5 — Status AMARELO: fallback de alerta
**Regra:** BR §5 — "Qualquer situação dentro do expediente que não seja verde nem vermelha → AMARELO"
```
Dado: horário 10:00 dentro do expediente
  E: usage = 60% (não cobre VERDE: >50%)
  E: minutosParaReset = 30 (não cobre VERMELHO: <=45)
Quando: Smart Plan modal abre
Então: indicador tem cor amarela (#eab308)
```

#### TC-09.6 — Status ROXO: otimizador pré-sessão
**Regra:** BR §5 — "usoSessao === 0 E dentro da janela de 90min antes do ideal → ROXO"
```
Dado: horário 07:30 (dentro do expediente), uso = 0%
  E: horário ideal calculado = 08:00
  E: horário atual está dentro da janela [07:00–08:00] (90min antes)
Quando: Smart Plan modal abre
Então: indicador tem cor roxa (#a855f7)
  E: exibe sugestão de horário para iniciar sessão
```

#### TC-09.7 — Timeline: marcador "Agora" visível
**Regra:** BR §5 — "Expansão para minutosAtuais: marcador 'Agora' ficaria fora sem expansão"
```
Dado: Smart Plan modal aberto com horário atual às 08:00 (início do expediente)
Quando: timeline renderizar
Então: marcador "Agora" está visível na timeline
  E: está posicionado no início do eixo
```

#### TC-09.8 — Timeline: reset após meia-noite exibe "(+1d)"
**Regra:** BR §5 — "resetCrossesDay: reset indicado textualmente com (+1d)"
```
Dado: horário atual 22:00, reset previsto para 03:00 do dia seguinte
Quando: Smart Plan modal abrir
Então: timeline exibe texto com "(+1d)" para o marcador de reset
```

#### TC-09.9 — Re-cálculo on-demand ao abrir modal
**Regra:** BR §10 — "Ao abrir modal Smart Plan, renderer solicita via IPC get-smart-status com now = new Date()"
```
Dado: último poll foi há 25 minutos (modo idle)
Quando: usuário abre modal Smart Plan
Então: window.claudeUsage.getSmartStatus() (ou equivalente) foi chamado
  E: timeline reflete a hora atual, não a hora do último poll
```

---

## Suite 10 — Internacionalização (i18n)
> Módulo: §9 Interface e UX — Internacionalização

### Cenários

#### TC-10.1 — Todos elementos data-i18n traduzidos em EN
**Regra:** BR §9 — "Nenhuma string visível deve ser hardcoded"
```
Dado: idioma configurado como 'en'
Quando: app inicializar
Então: nenhum elemento [data-i18n] está com textContent vazio
  E: nenhum elemento exibe chave de tradução crua (ex: "gaugeLabel")
```

#### TC-10.2 — Todos elementos data-i18n traduzidos em PT-BR
```
Dado: getSettings retorna { language: 'pt-BR' }
Quando: app inicializar
Então: nenhum elemento [data-i18n] está com textContent vazio
  E: #gauge-label-session exibe texto em português
```

#### TC-10.3 — Troca de idioma atualiza UI imediatamente
**Regra:** BR §9 — "Labels atualizam instantaneamente"
```
Dado: app com idioma 'en'
  E: #settings-modal aberto
Quando: usuário muda idioma para 'pt-BR' e salva
Então: labels da UI mudam para português sem recarregar a página
```

#### TC-10.4 — Burn rate exibe formato correto por idioma
**Regra:** BR §3 — "↑ X.X%/h · esgota ~HH:MM (pt-BR) / exhausts ~HH:MM (en)"
```
Dado: idioma 'pt-BR', burn rate ativo
Então: #burn-rate-line contém a palavra "esgota"

Dado: idioma 'en', burn rate ativo
Então: #burn-rate-line contém a palavra "exhausts"
```

---

## Suite 11 — Cloud Sync
> Módulo: §7 Sincronização em Nuvem

### Cenários

#### TC-11.1 — Painel de setup exibe quando sync desabilitado
```
Dado: getSettings retorna { cloudSync: { enabled: false } }
Quando: painel cloud sync abrir
Então: formulário de setup está visível (serverUrl, deviceLabel)
```

#### TC-11.2 — Habilitar sync chama sync.enable()
```
Dado: formulário de cloud sync preenchido
Quando: usuário clica em "Habilitar"
Então: window.claudeUsage.sync.enable(serverUrl, deviceLabel) foi chamado
```

#### TC-11.3 — Status de sync exibido
**Regra:** BR §7 — estados: 'synced' | 'syncing' | 'error'
```
Dado: sync habilitado
  E: sync.getStatus() retorna { status: 'synced', lastSyncAt: Date.now() }
Quando: painel de cloud sync renderizar
Então: ícone/texto de status "Sincronizado" está visível
```

#### TC-11.4 — Erro de sync exibe mensagem de erro
```
Dado: sync habilitado
  E: sync.onEvent emite { type: 'sync-error', message: 'Connection refused' }
Quando: painel renderizar
Então: mensagem de erro "Connection refused" está visível
```

#### TC-11.5 — Desabilitar sync chama sync.disable()
```
Dado: sync habilitado e painel visível
Quando: usuário clica em "Desabilitar"
Então: window.claudeUsage.sync.disable() foi chamado
```

---

## Suite 12 — Atualizações
> Módulo: §12 Verificação de Atualizações

### Cenários

#### TC-12.1 — Banner de atualização persiste até o usuário agir
**Regra:** BR §12 — "Banner azul persiste até o usuário atualizar ou fechar"
```
Dado: onUpdateAvailable({ version: '1.6.0', isMajor: false })
Quando: popup é fechado e reaberto
Então: banner de atualização ainda está visível
```

#### TC-12.2 — Progresso de download exibido no modal
**Regra:** BR §12 — "Progresso emitido via IPC update-download-progress (0–100%)"
```
Dado: #update-major-modal aberto com downloadUrl disponível
Quando: usuário clica em "Baixar"
  E: onUpdateDownloadProgress(50) é emitido
Então: barra de progresso exibe 50%
```

#### TC-12.3 — "Mais tarde" em major NÃO define skippedVersion
**Regra:** BR §12 — "Para updates major, skippedVersion nunca é setado — modal sempre reaparece"
```
Dado: #update-major-modal aberto (isMajor: true)
Quando: usuário clica em "Mais tarde"
Então: modal fecha
  E: saveSettings NÃO foi chamado com skippedVersion
```

---

## Suite 13 — Polling e Auto-Refresh
> Módulo: §2 Coleta e Monitoramento

### Cenários

#### TC-13.1 — triggerNow é no-op durante rate limit
**Regra:** BR §2 — "triggerNow() → No-op se rate limited"
```
Dado: app com rate limit ativo
Quando: usuário clica em "Atualizar agora" (triggerNow)
Então: pollingService.triggerNow() é chamado mas NÃO inicia nova coleta imediata
```

#### TC-13.2 — forceNow funciona mesmo durante rate limit
**Regra:** BR §2 — "forceNow() → Limpa estado de rate limit e executa"
```
Dado: app com rate limit ativo
Quando: usuário clica em "Forçar atualização" (forceNow — ação explícita do usuário)
Então: window.claudeUsage.forceRefreshNow() é chamado
  E: banner de rate limit desaparece
```

#### TC-13.3 — Auto-refresh ativo mostra indicador
**Regra:** BR §6 — "autoRefresh: Força re-fetch em intervalo fixo na UI"
```
Dado: getSettings retorna { autoRefresh: true, autoRefreshInterval: 30 }
Quando: app inicializar
Então: indicador de auto-refresh está ativo/visível
```

---

## Fixtures Detalhados

### `e2e/fixtures/usage-data.ts`
```typescript
import { UsageData } from '../../src/domain/types';

export const fixtures = {
  normal: {
    five_hour: { utilization: 0.45, resets_at: '2026-04-20T15:00:00Z' },
    seven_day: { utilization: 0.72, resets_at: '2026-04-27T00:00:00Z' },
  } as UsageData,

  over100Session: {
    five_hour: { utilization: 16.0, resets_at: '2026-04-20T15:00:00Z' },
    seven_day: { utilization: 0.20, resets_at: '2026-04-27T00:00:00Z' },
  } as UsageData,

  nearReset: {
    five_hour: { utilization: 0.98, resets_at: '2026-04-20T10:05:00Z' },
    seven_day: { utilization: 0.35, resets_at: '2026-04-27T00:00:00Z' },
  } as UsageData,

  lowUsage: {
    five_hour: { utilization: 0.03, resets_at: '2026-04-20T15:00:00Z' },
    seven_day: { utilization: 0.02, resets_at: '2026-04-27T00:00:00Z' },
  } as UsageData,

  rateLimitRisk: {
    five_hour: { utilization: 0.90, resets_at: '2026-04-20T11:00:00Z' },
    seven_day: { utilization: 0.80, resets_at: '2026-04-27T00:00:00Z' },
  } as UsageData,
};
```

### `e2e/fixtures/settings.ts`
```typescript
import { AppSettings } from '../../src/domain/types';

export const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'en',
  pollIntervalMinutes: 10,
  windowSize: 'large',
  autoRefresh: false,
  autoRefreshInterval: 600,
  notifications: {
    enabled: true,
    sessionThreshold: 80,
    weeklyThreshold: 80,
    resetThreshold: 50,
    notifyOnReset: false,
    notifyOnWindowReset: true,
    soundEnabled: true,
  },
  showHistory: true,
  showDailyChart: true,
  showExtraBars: true,
  showFooter: true,
  compactMode: false,
  essentialMode: false,
  monthlyBudget: 50,
  costModel: 'sonnet',
  cloudSync: { enabled: false, serverUrl: '', deviceId: '', deviceLabel: '' },
  workSchedule: {
    activeDays: [1,2,3,4,5],
    startHour: 8, startMinute: 0,
    endHour: 18, endMinute: 0,
    breakStartHour: 12, breakStartMinute: 0,
    breakEndHour: 13, breakEndMinute: 0,
  },
};
```

### `e2e/helpers/ipc-mock.ts`
```typescript
export function buildIpcMock(overrides = {}) {
  const handlers: Record<string, Function[]> = {};

  const mock = {
    // Invokes
    getSettings: async () => ({ ...defaultSettings, ...overrides }),
    saveSettings: jest.fn(),
    getAppVersion: async () => '18.0.0',
    getProfile: async () => ({ email: 'test@example.com', name: 'Test User' }),
    getDailyHistory: async () => [],
    getDayTimeSeries: async () => [],
    getSessionWindows: async () => [],
    getCurrentSessionWindow: async () => null,
    getCostEstimate: async () => null,
    refreshNow: jest.fn(),
    forceRefreshNow: jest.fn(),
    startOAuthLogin: jest.fn(),
    closeWindow: jest.fn(),
    setWindowHeight: jest.fn(),

    // Event listeners
    onUsageUpdated: (cb) => { handlers['usage'] = [cb]; },
    onError: (cb) => { handlers['error'] = [cb]; },
    onRateLimited: (cb) => { handlers['rateLimited'] = [cb]; },
    onUpdateAvailable: (cb) => { handlers['update'] = [cb]; },
    onCredentialMissing: (cb) => { handlers['credMissing'] = [cb]; },
    onCredentialsExpired: (cb) => { handlers['credExpired'] = [cb]; },
    onOAuthLoginComplete: (cb) => { handlers['oauthOk'] = [cb]; },
    onOAuthLoginError: (cb) => { handlers['oauthErr'] = [cb]; },
    onProfileUpdated: (cb) => { handlers['profile'] = [cb]; },
    onSmartStatusUpdated: (cb) => { handlers['smartStatus'] = [cb]; },
    onNextPollAt: (cb) => { handlers['nextPoll'] = [cb]; },
    onLastResponse: (cb) => { handlers['lastResp'] = [cb]; },
    onUpdateDownloadProgress: (cb) => { handlers['dlProgress'] = [cb]; },

    // Sync namespace
    sync: {
      getStatus: async () => ({ status: 'disconnected' }),
      enable: jest.fn(),
      disable: jest.fn(),
      triggerNow: jest.fn(),
      onEvent: (cb) => { handlers['syncEvent'] = [cb]; },
    },

    // Server namespace
    server: {
      getStatus: async () => ({ status: 'disconnected', clientCount: 0 }),
      connect: jest.fn(),
      disconnect: jest.fn(),
      getClientCount: async () => 0,
      onStatusChange: (cb) => { handlers['serverStatus'] = [cb]; },
      onClientCountChange: (cb) => { handlers['clientCount'] = [cb]; },
    },

    // Test helper — dispara eventos simulados
    __emit: (event: string, ...args: any[]) => {
      handlers[event]?.forEach(cb => cb(...args));
    },
  };

  return mock;
}
```

---

## playwright.config.ts

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // Electron não usa browser — sem projects de browser
});
```

---

## Priorização de Implementação

### Fase 1 — Setup + Smoke Tests (MVP)
**Objetivo:** Provar que a infraestrutura Playwright+Electron funciona

| # | Teste | Arquivo |
|---|-------|---------|
| 1 | App inicializa sem erro | 01-dashboard.spec.ts |
| 2 | Gauge renderiza com dados mockados | 01-dashboard.spec.ts |
| 3 | Modal de configurações abre/fecha | 04-modals/settings.spec.ts |
| 4 | Troca de idioma EN→PT-BR funciona | 06-i18n.spec.ts |
| 5 | Banner de rate limit aparece/desaparece | 03-banners.spec.ts |

### Fase 2 — Regras Críticas de Negócio
**Objetivo:** Cobrir cenários com maior risco de regressão

| # | Teste | Regra |
|---|-------|-------|
| 6 | Utilização > 100% exibe ">1600%" | BR §3 |
| 7 | Janela fechada exibe `final`, não `peak` | BR §3 |
| 8 | Smart Scheduler 5 estados do semáforo | BR §5 |
| 9 | Modal credenciais no 401 | BR §2 |
| 10 | Gauge de orçamento verde/amarelo/vermelho | BR §8 |

### Fase 3 — Cobertura Completa
- Todos os 52 cenários detalhados acima
- Screenshots de referência visuais
- Testes de regressão automatizados no CI

---

## Script no package.json

```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:report": "playwright show-report"
}
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| `window.claudeUsage` injetado antes do mock | Alta | Usar `page.addInitScript()` antes de `waitForLoadState` |
| Canvas do gauge difícil de testar | Média | Testar apenas presença do canvas + dados de entrada; screenshot como fallback |
| Tempo de build lento em CI | Média | Separar `npm run build` como step pré-teste no pipeline |
| Electron versão incompatível com Playwright | Baixa | Usar `@playwright/test` compatível com a versão do Electron atual |
| Testes flaky por timing de IPC | Média | Usar `waitForSelector` e `page.waitForFunction` em vez de timeouts fixos |

---

## Referências

- BUSINESS_RULES.md v8.x
- `src/preload.ts` — interface `window.claudeUsage`
- `src/renderer/AppBootstrap.ts` — sequência de inicialização
- `src/renderer/partials/` — IDs dos elementos HTML
- Playwright Electron docs: https://playwright.dev/docs/api/class-electron
