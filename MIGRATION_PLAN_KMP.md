# Plano de Migracaco: Claude Usage Monitor — Electron/TS para Kotlin Multiplatform

## Contexto

O Claude Usage Monitor e um app de system tray (Windows/Linux) que monitora limites de uso do Claude AI via API Anthropic. Atualmente usa Electron + TypeScript (main process + renderer com IPC). A migracao para KMP/Compose Desktop visa:
- Eliminar a complexidade do IPC (24 canais) e o overhead do Chromium
- Binario menor (~45 MB vs ~80 MB do Electron)
- Menor consumo de RAM (~60 MB vs ~150 MB)
- Potencial multiplataforma futuro (Android, macOS)
- Tipo seguro end-to-end com uma unica linguagem

---

## 1. Mapeamento de Stack

| Electron/TS | KMP/Compose | Notas |
|---|---|---|
| `BrowserWindow` (frameless popup) | `Window(undecorated=true, transparent=true)` | `WindowState` para posicao/tamanho |
| `Tray` + `nativeImage` | `Tray` composable + custom `Painter` | Icon dinamico via `DrawScope` direto, sem roundtrip canvas→PNG→IPC |
| IPC (24 canais, preload, contextBridge) | **Eliminado** — `StateFlow` direto | Maior simplificacao da migracao |
| `EventEmitter` (pollingService) | `SharedFlow` / `StateFlow` + Coroutines | `collectAsState()` no Compose |
| `electron-store` (JSON) | `kotlinx-serialization-json` + `File` I/O | Mesmo formato JSON, mesmos diretorios |
| Node.js `https` | **Ktor Client** (engine CIO) | `HttpRequestRetry` plugin para 5xx |
| Chart.js doughnut gauges | **Compose Canvas** `drawArc()` | Animacao via `animateFloatAsState()` |
| Chart.js sparklines | **Compose Canvas** `drawPath()` | Path com `lineTo()` por ponto |
| DOM bar chart (ciclo semanal) | `Row` + `Column` com `Box` bars | Tooltip via `Popup` composable |
| `Notification` (Electron) | `trayState.sendNotification()` | Som via `Toolkit.beep()` |
| `app.setLoginItemSettings()` | `expect/actual`: Registry (Win) / `.desktop` (Linux) | ~20 linhas por plataforma |
| `powerMonitor.getSystemIdleTime()` | JNA `GetLastInputInfo` (Win) / `xprintidle` (Linux) | Via `expect/actual` |
| `globalShortcut` (Ctrl+Shift+U) | **JNA** `RegisterHotKey` (Win) / D-Bus (Linux) | Sem JNativeHook — evita falsos positivos de antivirus |
| esbuild + tsc | Gradle KMP plugin | Setup padrao Compose Desktop |
| electron-builder (NSIS/portable) | `jpackage` via Compose Gradle plugin | MSI, DEB, RPM nativos |
| Acrylic (Windows) | JNA `DwmSetWindowAttribute` | Requer call nativo pos-criacao da window |

---

## 2. Estrutura de Modulos

```
claude-usage-monitor-kmp/
├── settings.gradle.kts
├── build.gradle.kts                     # Kotlin version, compose plugin
├── gradle.properties                    # compose.version, kotlin.version
│
├── shared/                              # Modulo KMP compartilhado
│   ├── build.gradle.kts                 # kotlin("multiplatform"), serialization, ktor
│   └── src/
│       ├── commonMain/kotlin/com/claudeusage/monitor/
│       │   ├── model/
│       │   │   ├── UsageData.kt         # @Serializable: UsageSnapshot, DailySnapshot, UsageWindow, etc.
│       │   │   ├── AppSettings.kt       # @Serializable: AppSettings, NotificationSettings, AccountData
│       │   │   └── UpdateCheckResult.kt
│       │   ├── service/
│       │   │   ├── UsageApiService.kt   # Ktor: fetchUsageData(), fetchProfileData()
│       │   │   ├── PollingService.kt    # Coroutines + StateFlow<UsageData?>
│       │   │   ├── DailySnapshotService.kt  # Pure function (1:1 port)
│       │   │   ├── NotificationService.kt   # Logica pura + expect fun showToast()
│       │   │   ├── SettingsService.kt       # JsonFileStore generico
│       │   │   ├── UpdateService.kt         # GitHub releases via Ktor
│       │   │   └── CredentialService.kt     # Token read/refresh (paths via expect/actual)
│       │   ├── i18n/
│       │   │   └── Translations.kt     # Todas ~70 chaves, en + pt-BR (unificado)
│       │   └── util/
│       │       └── TimeFormatting.kt
│       │
│       ├── commonTest/kotlin/...        # Testes unitarios puros
│       │
│       └── jvmMain/kotlin/com/claudeusage/monitor/platform/
│           ├── CredentialPaths.kt       # actual: Windows nativo + WSL, Linux ~/.claude/
│           ├── StartupService.kt        # actual: Registry (Win) / .desktop (Linux)
│           ├── IdleDetector.kt          # actual: JNA GetLastInputInfo / xprintidle
│           ├── AppDataDir.kt            # actual: %APPDATA% ou ~/.config/
│           └── ClaudeVersionDetector.kt # actual: ProcessBuilder("claude", "--version")
│
├── desktopApp/                          # Modulo Compose Desktop
│   ├── build.gradle.kts
│   └── src/jvmMain/kotlin/com/claudeusage/monitor/
│       ├── Main.kt                      # application { Tray(...); Window(...) { App() } }
│       ├── App.kt                       # Root composable
│       ├── theme/
│       │   ├── Theme.kt                 # Dark/Light/System MaterialTheme
│       │   └── Colors.kt               # Esquema de cores (match CSS atual)
│       ├── ui/
│       │   ├── GaugeView.kt            # Canvas half-doughnut 180 graus
│       │   ├── DailyCycleChart.kt       # Row+Column bar chart
│       │   ├── SparklineChart.kt        # Canvas path sparkline 24h
│       │   ├── SettingsPanel.kt         # Switches, dropdowns, sliders
│       │   ├── ProfileBar.kt           # Barra de conta
│       │   ├── RateLimitBanner.kt       # Countdown banner
│       │   ├── ErrorBanner.kt
│       │   ├── UpdateBanner.kt
│       │   ├── CredentialModal.kt
│       │   └── EditSnapshotModal.kt
│       ├── tray/
│       │   ├── TrayIconPainter.kt       # Custom Painter dinamico
│       │   └── TrayMenuBuilder.kt
│       ├── viewmodel/
│       │   └── AppViewModel.kt          # Orquestra services, expoe UI state
│       └── util/
│           ├── WindowPositioning.kt     # Posicao perto do tray
│           ├── GlobalHotkey.kt          # JNativeHook
│           └── BackupManager.kt         # Export/import JSON
│
└── assets/
    ├── icon.ico
    ├── icon-linux.png
    └── tray-icon.png
```

### Classificacao de Cada Arquivo Atual

**`commonMain` (puro, sem dependencia de plataforma):**
- `usageData.ts` → `model/UsageData.kt` (data classes `@Serializable`)
- `dailySnapshotService.ts` → `service/DailySnapshotService.kt` (funcao pura, port 1:1)
- `settingsService.ts` → `service/SettingsService.kt` (usa `expect fun appDataDir()`)
- `notificationService.ts` → `service/NotificationService.kt` (logica pura, chama `expect fun showSystemNotification()`)
- `pollingService.ts` → `service/PollingService.kt` (coroutines + Flow, usa `expect fun getSystemIdleSeconds()`)
- `usageApiService.ts` → `service/UsageApiService.kt` (Ktor e multiplatform)
- `updateService.ts` → `service/UpdateService.kt` (Ktor)
- `mainTranslations.ts` + i18n do renderer → `i18n/Translations.kt` (unificado)
- Utilidades de tempo → `util/TimeFormatting.kt`

**`expect/actual` (commonMain declara, jvmMain implementa):**
- Paths de credenciais (WSL discovery no Windows)
- Auto-start (Registry / .desktop)
- Idle detection (JNA / xprintidle)
- Diretorio de dados da app (%APPDATA% / ~/.config/)
- Deteccao de versao do Claude CLI

**`desktopApp` (JVM-only, Compose Desktop):**
- `main.ts` → `Main.kt` + `App.kt` + `AppViewModel.kt`
- `renderer/app.ts` → Split em ~12 composables em `ui/`
- `preload.ts` → **Eliminado** (sem IPC)
- `renderer/styles.css` → Compose Modifiers + Theme
- Tray icon rendering → `TrayIconPainter.kt`

---

## 3. Plano de Migracao em Sprints

### Sprint 1: Scaffolding + Models + Logica Pura (1 semana)

**Objetivo:** Projeto Gradle compila, models definidos, servicos puros testados.

**Entregas:**
1. Inicializar projeto Gradle com `settings.gradle.kts`, root `build.gradle.kts`
2. Configurar `shared/build.gradle.kts`:
   - Plugins: `kotlin("multiplatform")`, `kotlin("plugin.serialization")`
   - Target: `jvm()`
   - Deps: `kotlinx-serialization-json`, `kotlinx-coroutines-core`, `kotlinx-datetime`
3. Definir todos os data classes em `model/UsageData.kt` com `@Serializable`
4. Portar `DailySnapshotService` (funcao pura, traducao 1:1 do TS)
5. Portar `i18n/Translations.kt` com todas ~70 chaves (merge main + renderer)
6. Portar utilidades de formatacao de tempo
7. Escrever testes unitarios (portar testes Vitest existentes)

**Verificacao:** `./gradlew :shared:jvmTest` — todos os testes passam.

**Arquivos-fonte de referencia:**
- `src/models/usageData.ts` (13 interfaces)
- `src/services/dailySnapshotService.ts` (52 linhas, puro)
- `src/i18n/mainTranslations.ts` + traducoes do renderer

---

### Sprint 2: Camada de Rede + Credential Service (1 semana)

**Objetivo:** Buscar dados de uso e perfil da API Anthropic.

**Entregas:**
1. Adicionar deps Ktor: `ktor-client-core`, `ktor-client-cio`, `ktor-client-content-negotiation`, `ktor-serialization-kotlinx-json`
2. Portar `UsageApiService`:
   - `HttpClient(CIO)` com `HttpRequestRetry` (retry apenas em 5xx, max 3)
   - 429: ler headers `anthropic-ratelimit-*-reset`, lancar `RateLimitException`
   - **Regra critica mantida: nunca retry em 429**
3. Portar `CredentialService`:
   - `expect fun findCredentialPaths(): List<String>` em commonMain
   - `actual fun` em jvmMain: path nativo + WSL discovery (Windows)
   - Refresh de token OAuth via Ktor POST
4. Portar `ClaudeVersionDetector` (`ProcessBuilder`)
5. Portar `UpdateService` (GitHub releases via Ktor)
6. Testes com Ktor `MockEngine`

**Verificacao:** Teste de integracao manual busca dados reais da API. Testes unitarios com MockEngine.

**Arquivos-fonte de referencia:**
- `src/services/usageApiService.ts` (160 linhas)
- `src/services/credentialService.ts` (169 linhas)
- `src/services/updateService.ts` (63 linhas)

---

### Sprint 3: Polling Engine + Persistencia de Settings (1 semana)

**Objetivo:** Loop de polling roda, estado persistido em JSON, logica de rate limit funciona.

**Entregas:**
1. Portar `SettingsService`:
   - `JsonFileStore<T>` generico: `kotlinx.serialization.json` + `File` I/O
   - `expect fun appDataDir(): String` — Win: `%APPDATA%/Claude Usage Monitor`, Linux: `~/.config/claude-usage-monitor`
   - Dois stores: `config.json` (AppSettings) + `accounts.json` (AccountData por email)
   - Logica de migracao de legacy preservada
2. Portar `PollingService` baseado em coroutines:
   - `CoroutineScope(SupervisorJob() + Dispatchers.Default)`
   - Expoe: `val usageData: StateFlow<UsageData?>`, `val rateLimitState: StateFlow<RateLimitInfo>`, `val nextPollAt: StateFlow<Long>`, `val errors: SharedFlow<Throwable>`
   - Mesmos intervalos: Normal=10min, Fast=7min, Idle=30min, Error=1min*2^n, RateLimit=API reset ou 5min*2^n
   - `expect fun getSystemIdleSeconds(): Int`
   - Metodos: `start()`, `stop()`, `triggerNow()`, `forceNow()`, `pause()`, `resume()`, `setCustomInterval()`
3. Portar `NotificationService` (logica pura, `expect fun showSystemNotification()`)
4. Conectar polling → daily snapshot → persistencia
5. Testes unitarios com `kotlinx-coroutines-test` (`TestDispatcher`, `advanceTimeBy()`)

**Verificacao:** `./gradlew :shared:jvmTest`. Programa JVM standalone que faz polling e imprime no console.

**Arquivos-fonte de referencia:**
- `src/services/pollingService.ts` (201 linhas — mais complexo)
- `src/services/settingsService.ts` (254 linhas)
- `src/services/notificationService.ts` (108 linhas)

---

### Sprint 4: UI Shell — Compose Desktop Window + Tray (1.5 semanas)

**Objetivo:** App lanca com tray icon, popup toggle, layout basico visivel.

**Entregas:**
1. Configurar `desktopApp/build.gradle.kts` com `org.jetbrains.compose`
2. Implementar `Main.kt`:
   - `application { }` com `Tray` + `Window(undecorated=true, transparent=true)`
   - Toggle visibilidade no click do tray
   - Context menu: Refresh, Pause/Resume, Backup, Import, Auto-start, Exit
3. Implementar `AppViewModel`:
   - Referencia todos os services
   - Expoe estado composto como `StateFlow`
   - Orquestra startup: restaura rate limit, inicia polling, busca perfil
4. Implementar `App.kt` layout basico:
   - Header (dot status, titulo, botao fechar)
   - ProfileBar
   - Area de conteudo (placeholder)
   - Footer (hora update, botao refresh, versao)
5. Implementar `Theme.kt`: Dark, Light, System (mapear cores CSS atuais)
6. Implementar `WindowPositioning.kt`: capturar posicao do mouse via `MouseInfo.getPointerInfo().location` no callback `onAction` do Tray como ancora exata do popup (resolve o problema de tray icons ocultos no Windows 11). Fallback: workArea clamp
7. Implementar `TrayIconPainter`: `Painter` custom com `drawCircle` + `drawArc` + `drawText`

**Verificacao:** App lanca, aparece no tray, click toggle popup, icon atualiza, tema funciona.

**Arquivos-fonte de referencia:**
- `src/main.ts` (739 linhas — decompoem-se em Main.kt + AppViewModel + WindowPositioning)

---

### Sprint 5: Gauges, Charts e UI Completa (1.5 semanas)

**Objetivo:** Paridade visual com o renderer Electron atual.

**Entregas:**
1. `GaugeView.kt` — Canvas half-doughnut:
   - `drawArc(startAngle=180f, sweepAngle=pct*1.8f)` com track cinza + arco colorido
   - Texto percentual via `drawText()` (`TextMeasurer`)
   - Animacao: `animateFloatAsState(targetValue = pct)`
   - Cores: verde (<60%), amarelo (60-80%), vermelho (>=80%)
2. `DailyCycleChart.kt` — Grafico de barras semanal:
   - `Row` com 8 colunas (dias)
   - Barras: Sessao (verde), Semanal (azul), Credits (azul claro)
   - Tooltips via `Modifier.pointerInput` + `Popup`
   - Edicao manual via double-click → `EditSnapshotModal`
3. `SparklineChart.kt` — Historico 24h:
   - `Canvas { drawPath(path, color, style = Stroke(2f)) }`
   - Duas linhas: Sessao (verde) e Semanal (azul)
4. `SettingsPanel.kt`: Switch, DropdownMenu, Slider para todos os settings
5. `RateLimitBanner.kt`: countdown com `LaunchedEffect { delay(1000) }`
6. Banners de erro, update, credential missing
7. Modais: EditSnapshot, ForceRefresh

**Verificacao:** Comparacao visual lado-a-lado com versao Electron. Gauges animam, charts renderizam, settings funcional.

**Arquivos-fonte de referencia:**
- `src/renderer/app.ts` (~700 linhas → split em ~12 composables)
- `src/renderer/styles.css` (esquema de cores → Theme.kt)

---

### Sprint 6: Paridade Total de Features (1 semana)

**Objetivo:** Toda feature da versao Electron funcionando.

**Entregas:**
1. **Notificacoes**: `actual fun showSystemNotification()` via `trayState.sendNotification()` + `Toolkit.beep()`
2. **Auto-start**:
   - Windows: `ProcessBuilder("reg", "add", "HKCU\\...\\Run", "/v", "ClaudeUsageMonitor", "/d", exePath, "/f")`
   - Linux: escrever `.desktop` em `~/.config/autostart/`
3. **Global hotkey** (Ctrl+Shift+U):
   - Windows: JNA `User32.RegisterHotKey()` — API nativa, sem hook de teclado global, sem alerta de antivirus
   - Linux: D-Bus ou `xdotool` (aceitar limitacao se indisponivel)
4. **Backup/Import**:
   - Export JSON para `appDataDir()/backups/bk_<timestamp>.json`
   - Import via `FileDialog` do Compose Desktop
   - Max 8 backups, auto-backup no reset semanal
5. **Single instance lock**: `java.nio.channels.FileLock` no appDataDir
6. **Idle detection**: `actual fun getSystemIdleSeconds()` via JNA (Win) / xprintidle (Linux)
7. **Window behavior**: blur-hide, acrylic (JNA `DwmSetWindowAttribute` no Windows)

**Verificacao:** Notificacoes disparam, auto-start funciona apos reboot, hotkey toggle window, backup/import ok.

**Arquivos-fonte de referencia:**
- `src/services/startupService.ts` (9 linhas → ~20 por plataforma)
- `src/services/notificationService.ts`

---

### Sprint 7: Packaging e Distribuicao (1 semana)

**Objetivo:** Artefatos instalaveis para Windows e Linux.

**Entregas:**
1. Configurar `nativeDistributions` no Gradle:
   - Windows: MSI (substitui NSIS) + distributable zipado (portable)
   - Linux: DEB, RPM (AppImage via `appimagetool` do distributable)
2. **JVM runtime otimizado**: `jlink` com modulos minimos → ~40-50 MB
3. **GitHub Actions workflow**: matrix Windows + Ubuntu, JDK 17, build + upload artifacts
4. **Avaliar Conveyor** (`hydraulic.dev`) se precisar de customizacao nivel NSIS

**Verificacao:** Instalacao limpa em Windows VM e Linux VM. Portable funciona sem instalacao. Tamanho <55 MB.

---

### Sprint 8: Testes, QA e Polish (1 semana)

**Objetivo:** Build com qualidade de release.

**Entregas:**
1. Cobertura de testes unitarios: 80%+ no modulo shared
2. Testes de integracao (API real, manual trigger)
3. **Migracao de dados**: verificar que `config.json` e `accounts.json` existentes do Electron sao lidos pelo KMP (mesmo schema)
4. Verificacao cross-platform: Windows 10, 11, Ubuntu 22.04, Fedora 39
5. Profiling de performance: memoria, startup (<3s)
6. Edge cases: rate limit recovery, credential refresh, rede offline, utilization >100% (ate 1600%), WSL credentials
7. Atualizar README com novas instrucoes de build

**Verificacao:** Todas as features passam em ambos OS. Testes automatizados verdes. Performance aceitavel.

---

## 4. Analise de Riscos

| Feature | Risco | Mitigacao |
|---|---|---|
| Transparencia + Acrylic (Windows) | MEDIO | `Window(transparent=true)` funciona. Acrylic via JNA `DwmSetWindowAttribute` — documentado mas precisa teste por build |
| Posicao do popup perto do tray | **BAIXO** (mitigado) | Capturar `MouseInfo.getPointerInfo().location` no callback `onAction` do Tray — ancora exata do clique, funciona mesmo com tray icons ocultos no Win11 |
| Global hotkey | **BAIXO** (mitigado) | JNA `RegisterHotKey` (Win) em vez de JNativeHook — evita falsos positivos de antivirus. Linux via D-Bus |
| Idle detection | MEDIO | JNA no Windows, `xprintidle` no Linux. Fallback: polling normal se indisponivel |
| WSL credential discovery | BAIXO | `File("\\\\wsl.localhost").listFiles()` funciona identico ao Node.js |
| File dialogs | BAIXO | `FileDialog` do Compose Desktop ou `JFileChooser` |

### Vantagens da Migracao

1. **Sem IPC**: 24 canais eliminados. Services acessados diretamente via StateFlow
2. **Type safety end-to-end**: Uma linguagem, sem duplicacao de interfaces
3. **Binario menor**: ~45 MB (jpackage+jlink) vs ~80 MB (Electron+Chromium)
4. **Menor RAM**: ~60 MB vs ~150 MB (sem Chromium)
5. **Coroutines superiores**: StateFlow mais expressivo que EventEmitter+IPC. TestDispatcher para testes deterministicos
6. **Potencial futuro**: Modulo `shared` pode alimentar app Android/macOS
7. **Rendering nativo**: Compose Canvas via Skia, sem overhead de DOM

### Dependencias-Chave

| Dependencia | Proposito | Maturidade |
|---|---|---|
| `org.jetbrains.compose` | UI Desktop | Producao (JetBrains Toolbox usa) |
| `io.ktor:ktor-client-cio` | HTTP client | Estavel |
| `kotlinx-serialization-json` | JSON | Estavel |
| `kotlinx-coroutines-core` | Async | Estavel |
| ~~`jnativehook`~~ (removido) | ~~Global hotkeys~~ | Substituido por JNA `RegisterHotKey` para evitar alertas de antivirus |
| `net.java.dev.jna:jna` | Windows API (idle, acrylic) | Padrao da industria |

---

## 5. Estimativa Total

| Sprint | Duracao | Dependencia |
|---|---|---|
| 1. Scaffolding + Models | 1 semana | — |
| 2. Rede + Credentials | 1 semana | Sprint 1 |
| 3. Polling + Settings | 1 semana | Sprint 2 |
| 4. UI Shell + Tray | 1.5 semanas | Sprint 3 |
| 5. Gauges + Charts | 1.5 semanas | Sprint 4 |
| 6. Feature Parity | 1 semana | Sprint 5 |
| 7. Packaging | 1 semana | Sprint 6 |
| 8. QA + Polish | 1 semana | Sprint 7 |
| **Total** | **~9 semanas** | |

Sprints 1-3 sao sequenciais (cada um depende do anterior).
Sprints 4-5 podem ter algum paralelismo (UI shell independe parcialmente dos charts).
Sprints 6-8 sao sequenciais.

---

## 6. Decisao sobre Repositorio

**Opcao recomendada:** Criar novo repositorio `claude-usage-monitor-kmp` (ou branch `kmp-migration` no repo existente). O codigo Electron permanece funcional durante toda a migracao. Merge final quando Sprint 8 estiver concluido e validado.

---

## 7. Nota sobre Auto-Update

O projeto atual **nao possui auto-update silencioso**. O `updateService.ts` apenas checa releases do GitHub e mostra um toast com link para download manual. Essa paridade esta mantida no plano. Se no futuro quisermos auto-update (download + replace automatico), o caminho recomendado e o **Conveyor** (`hydraulic.dev`), ja que apps JVM via `jpackage` nao conseguem sobrescrever o proprio EXE enquanto rodam.

---

## 8. Revisao e Ajustes (2026-04-07)

Plano revisado com base em analise cruzada (Gemini). Ajustes realizados:

1. **Posicao do popup (Tray)**: Substituido "bottom-right do workArea" por captura de `MouseInfo.getPointerInfo().location` no callback `onAction` do Tray. Resolve tray icons ocultos no Win11. Risco rebaixado de MEDIO para BAIXO.

2. **Global hotkey**: Removido `jnativehook` (risco de falsos positivos de antivirus por hook de teclado global). Substituido por JNA `User32.RegisterHotKey()` no Windows + D-Bus no Linux. Elimina dependencia e reduz risco.

3. **Auto-update**: Documentado que paridade ja esta mantida (apenas notificacao, sem download automatico). Conveyor indicado como caminho futuro se necessario.
