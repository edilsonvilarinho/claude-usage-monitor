# Plano: Credencial Não Existe — CONSOLIDADO

**Status:** Pendente (precisa de ação do usuário)

---

## Problema

O arquivo `.credentials.json` não está sendo criado em `C:\Users\edils\.claude\`

O Claude Code mostra "Welcome back Edilson!" mas não cria o arquivo.

---

## Verificação

```bash
dir C:\Users\edils\.claude
```

**Resultado:** O diretório contém:
- `backups/`, `cache/`, `debug/`, `downloads/`, `file-history/`, `ide/`, `paste-cache/`, `plans/`, `plugins/`, `projects/`, `sessions/`, `shell-snapshots/`, `tasks/`
- `history.jsonl`, `settings.json`, `stats-cache.json`

**NÃO TEM:** `.credentials.json`

---

## Possíveis Causas

1. **Claude Code usa variável de ambiente** - `ANTHROPIC_API_KEY`
2. **Caminho mudou** - Nova versão do Claude Code pode usar local diferente
3. **Login via OAuth** - Usa tokens de sessão em vez de arquivo

---

## Soluções

### Solução 1: Verificar API Key
```powershell
$env:ANTHROPIC_API_KEY
```

### Solução 2: Forçar criação
No terminal do Claude Code, executar comando para gerar credencial.

### Solução 3: Login correto
1. Abrir o terminal
2. Executar `claude`
3. Seguir o fluxo de login no navegador
4. Esperar o arquivo ser criado em `C:\Users\edils\.claude\.credentials.json`

---

## Progresso

| Data | Hora | Status |
|------|------|--------|
| 15/04/2026 | 17:15 | Identificado |
| 15/04/2026 | 17:20 | Consolidado (2 planos em 1) |

---

## Histórico

- 15/04/2026 17:15 - Identificado que arquivo não existe
- 15/04/2026 17:20 - Consolidado com `credencial-nao-existe-2.md`