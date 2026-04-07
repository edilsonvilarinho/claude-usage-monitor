# Claude Usage Monitor

Aplicativo Windows para a bandeja do sistema que monitora seus limites de uso da IA Claude em tempo real — sem precisar do CLI do Claude ou de qualquer configuração adicional.

![Preview](img/1.png)
![Preview](img/2.png)
![Preview](img/3.png)

---

## Funcionalidades

### Medidores de Uso
- **Sessão (5h)** e **Semanal (7d)** — velocímetros semicirculares mostrando a utilização atual de forma imediata
- Código de cores progressivo: verde → amarelo (60%) → vermelho (80%)
- Exibe o tempo restante até cada janela de uso ser reiniciada
- Barras opcionais para uso do modelo **Sonnet** e **créditos extras** (exibidas apenas quando a conta possui créditos adicionais)

### Ícone na Bandeja do Sistema
- Anel de progresso circular ao vivo na bandeja do sistema, refletindo o maior valor entre os dois medidores
- Exibe o número percentual dentro do ícone
- Mostra `!!!` quando o uso ultrapassa 100%
- Tooltip ao passar o mouse exibe os percentuais de sessão e semanal, além da versão instalada

### Atualização Automática
- Polling automático da API em intervalos configuráveis
- Intervalo padrão: 7 minutos
- Modo rápido (5 min): ativado automaticamente quando detecta um pico de uso superior a 1%
- Modo ocioso (20 min): ativado automaticamente quando o sistema está inativo por mais de 10 minutos

### Gerenciamento de Rate Limit
- Quando a API retorna erro 429, o app para as tentativas imediatamente e exibe um banner de contagem regressiva
- Backoff exponencial em rate limits consecutivos: `5m → 10m → 20m → 40m → 60m` (limite máximo)
- Respeita o header `Retry-After` ou `X-RateLimit-Reset` quando a API os fornece
- A contagem regressiva e o estado de backoff **sobrevivem a reinicializações do app** — ao reabrir, o tempo correto restante é exibido
- Retoma o polling normal automaticamente quando o período de espera expira

### Notificações
- Toast nativo do Windows quando o uso ultrapassa o limiar configurado (sessão e/ou semanal)
- Alerta sonoro opcional
- Notificação quando uma janela de uso é reiniciada
- Botão de teste para visualizar a notificação antes de configurar
- Debounce inteligente — não notifica novamente até o uso cair abaixo de 50%

### Tamanhos de Janela Configuráveis
Quatro tamanhos disponíveis — escala os gráficos dos medidores:

| Tamanho | Descrição |
|---|---|
| Normal | Compacto |
| Médio | Medidores ligeiramente maiores |
| Grande | Medidores grandes, fácil leitura (padrão) |
| Muito Grande | Tamanho máximo dos medidores |

### Janela Movível
Arraste o popup para qualquer lugar da tela — ele permanece onde você o deixou. Retorna acima do ícone da bandeja somente ao fechar e reabrir o app.

### Temas
- **Sistema** — segue o modo claro/escuro do Windows automaticamente
- **Escuro**
- **Claro**

Efeito de desfoque Acrylic nativo do Windows 11 no fundo do popup.

### Idiomas
- English
- Português (BR)

### Configurações Gerais
- **Iniciar com o Windows** — registra no `HKCU\Run` para iniciar automaticamente com o sistema
- **Sempre visível** — desativa o auto-ocultar ao perder o foco

### Verificação de Atualizações
- Verifica automaticamente novas versões uma vez por dia via GitHub Releases
- Exibe toast de notificação e banner no popup quando há atualização disponível
- Não bloqueia o app em caso de falha na verificação (falha silenciosa)

---

## Como Funciona

O Claude Usage Monitor lê as credenciais diretamente do arquivo `~/.claude/.credentials.json` — o mesmo arquivo usado pelo Claude CLI — e chama a API da Anthropic com seu token OAuth. **Não é necessária nenhuma chave de API**: se você tem o Claude CLI instalado e está logado, o app simplesmente funciona.

O token OAuth é **renovado automaticamente** quando está próximo do vencimento (margem de 5 minutos).

O app também suporta instalações via **WSL (Windows Subsystem for Linux)**: ele busca automaticamente credenciais em todos os caminhos WSL disponíveis (`\\wsl.localhost\<distro>\home\<user>\.claude\`) e utiliza o arquivo modificado mais recentemente.

---

## Instalação

Baixe a versão mais recente na página de [Releases](../../releases):

- **`Claude Usage Monitor Setup.exe`** — instalador NSIS com opção de diretório customizável
- **`Claude Usage Monitor.exe`** — portátil, sem instalação necessária

### Compilar a partir do Código Fonte

**Requisitos:** Node.js 18+, Windows

```bash
git clone https://github.com/edilsonvilarinho/claude-usage-monitor
cd claude-usage-monitor
npm install

# Executar em modo de desenvolvimento
npm run dev

# Compilar (main + renderer)
npm run build

# Gerar instalador NSIS + EXE portátil
npm run dist

# Somente EXE portátil
npm run dist:portable

# Gerar tudo e zipar para release
npm run release
```

---

## Requisitos

- Windows 10 / 11
- [Claude CLI](https://claude.ai/download) instalado e com sessão ativa (`~/.claude/.credentials.json` deve existir)

---

## Privacidade

Todos os dados ficam locais. O app realiza apenas requisições para `api.anthropic.com` usando seu token OAuth existente do Claude — as mesmas requisições que o próprio CLI do Claude faz. **Sem telemetria, sem serviços de terceiros.**

---

## Licença

MIT
