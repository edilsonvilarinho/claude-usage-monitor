# Plano: Suporte de Autenticação para Usuários sem Claude Code CLI

## Requisito confirmado pelo usuário

> **Login via Claude Code CLI deve continuar funcionando.** Os dois modos coexistem: CLI, entrada manual (Estágio 1) e OAuth PKCE (Estágio 2) escrevem no mesmo `~/.claude/.credentials.json` no mesmo formato `CredentialsFile`. O `findCredentialPaths()` + `pickMostRecentFile()` já trata todos os casos sem alteração.

**Regras para a implementação:**
- `save-manual-credentials` escreve no path nativo Windows (`USERPROFILE/.claude/.credentials.json`)
- Modal aparece **somente** quando não há credenciais — nunca sobrescreve sem o usuário pedir
- `expiresAt` sempre em timestamp Unix ms (compatível com o CLI)
- `getAccessToken()`, `findCredentialPaths()`, `pickMostRecentFile()` e refresh automático **não mudam**

---

## Contexto

Usuários que usam Claude via browser chat (claude.ai) ou apenas via Agents web não têm o Claude Code CLI instalado e portanto não possuem `~/.claude/.credentials.json`. O app mostra o modal "Credenciais não encontradas" e não tem saída para esses usuários.

**Descoberta crítica:** O token do browser (`claude.ai`) é um cookie de sessão web — incompatível com `/api/oauth/usage` que exige um Bearer token OAuth PKCE (`anthropic-beta: oauth-2025-04-20`). Ou seja, ler localStorage/cookies do browser **não funciona** — o token seria inválido na API.

## Abordagens avaliadas

| Abordagem | Viabilidade | Esforço | Decisão |
|-----------|-------------|---------|---------|
| A. OAuth PKCE no Electron | 4/5 | Médio | ✅ Recomendada (Estágio 2) |
| B. Ler localStorage/cookies do WebView | 2/5 | Médio | ❌ Token incompatível |
| C. Ler Chrome instalado | 1/5 | Grande | ❌ DPAPI + AV detection + ToS |
| D. Entrada manual de token | 5/5 | Pequeno | ✅ Quick Win (Estágio 1) |
| E. Melhorar UI de erro | 5/5 | Mínimo | ✅ Junto ao Estágio 1 |

## Plano de implementação

### Estágio 1 — Quick Win: Entrada manual de token (1-2 dias)

Permite usuários técnicos colarem suas credenciais OAuth manualmente. Tokens colados são 100% compatíveis pois são o mesmo formato. O refresh automático funciona normalmente após o paste.

**Arquivos a modificar:**

1. **`src/renderer/index.html`** — Adicionar seção colapsável "Tenho as credenciais" no `#credential-modal` com campos para `accessToken`, `refreshToken` e botão "Salvar"

2. **`src/preload.ts`** — Expor novo IPC:
   ```typescript
   saveManualCredentials: (creds: {accessToken: string; refreshToken?: string}) =>
     ipcRenderer.invoke('save-manual-credentials', creds)
   ```

3. **`src/main.ts`** — Novo handler IPC `save-manual-credentials`:
   - Valida `accessToken` não-vazio
   - Constrói `CredentialsFile` com `expiresAt: Date.now() + 1h`
   - Escreve em `~/.claude/.credentials.json` via `writeCredentials()` (já existe em `credentialService.ts`)
   - Dispara `triggerNow()` após salvar

4. **`src/renderer/app.ts`** — Handler para botão "Salvar credenciais"

5. **`BUSINESS_RULES.md`** — Adicionar seção sobre entrada manual de credenciais

### Estágio 2 — Solução definitiva: OAuth PKCE no Electron (3-5 dias)

Replicar exatamente o fluxo que o Claude Code CLI faz. O token obtido é idêntico ao que o CLI salva em `~/.claude/.credentials.json`.

**Pré-requisito:** Encontrar o `client_id` OAuth da Anthropic:
```bash
# Se Claude Code CLI instalado no Windows:
npx @electron/asar extract "%LOCALAPPDATA%\AnthropicClaude\resources\app.asar" /tmp/cc-src
grep -r "client_id" /tmp/cc-src --include="*.js" | head -20
# Ou interceptar tráfego: charles/fiddler na primeira execução do `claude login`
```

**Arquivos a modificar/criar:**

1. **`src/services/oauthService.ts`** (novo) — Fluxo PKCE completo:
   - Gerar `code_verifier` (32 bytes random, base64url) + `code_challenge` (SHA256, base64url)
   - Registrar `claude-usage://` como protocol handler via `app.setAsDefaultProtocolClient`
   - Abrir BrowserWindow em `accounts.anthropic.com/oauth/authorize?client_id=...&code_challenge=...`
   - Capturar redirect `claude-usage://callback?code=xxx` via `app.on('open-url')`
   - Trocar code por tokens via `POST console.anthropic.com/v1/oauth/token` (grant_type=authorization_code)
   - Salvar via `writeCredentials()` no path padrão

2. **`src/main.ts`** — Registrar protocol handler no `app.whenReady()`, novo IPC `start-oauth-flow`

3. **`src/preload.ts`** — Expor `startOAuthFlow()` e `onOAuthComplete(cb)`

4. **`src/renderer/index.html`** — Botão primário "Fazer login com Claude" no modal

5. **`src/renderer/app.ts`** — Disparar `startOAuthFlow()` e fechar modal no `onOAuthComplete`

## Riscos

- **Estágio 1:** Sem riscos. Token fornecido pelo próprio usuário, 100% compatível.
- **Estágio 2:** `client_id` pode não ser encontrado. Uso do client_id do Claude Code viola ToS da Anthropic moderadamente (PKCE client_id é público por design, mas app não é registrado como cliente oficial). A Anthropic pode bloquear o `client_id`.

## Verificação

Estágio 1:
1. Remover `~/.claude/.credentials.json`, abrir o app → modal aparece
2. Colar um `accessToken` válido (copiar de uma instalação que tenha o arquivo) → clicar Salvar
3. Modal fecha, dados carregam normalmente
4. Aguardar expiração do token → refresh automático funciona

Estágio 2:
1. Mesmos passos sem arquivo de credenciais
2. Clicar "Fazer login com Claude" → browser abre na Anthropic
3. Fazer login → redirect capturado → credenciais salvas
4. App carrega dados sem intervenção adicional

## Arquivos críticos

- `src/services/credentialService.ts` — `writeCredentials()`, `findCredentialPaths()` a reusar
- `src/main.ts` — IPC handlers
- `src/renderer/index.html` — `#credential-modal`
- `src/preload.ts` — bridge IPC
- `src/renderer/app.ts` — handlers UI
