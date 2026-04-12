# /feat — New Feature Workflow

Workflow estruturado: issue → branch → implement → test → commit → PR.

> **Antes de começar**: SIMPLE (≤3 files, escopo claro) → implementa direto, sem subagentes. COMPLEX (muitos arquivos, escopo incerto) → Plan Mode com 1 Explore agent, aguardar aprovação.

---

## Step 1 — Create GitHub Issue

```bash
gh issue create \
  --title "feat: <short description>" \
  --body "$(cat <<'EOF'
## Summary
<what and why>

## Acceptance Criteria
- [ ] <criterion>
EOF
)"
```

Note o número do issue.

## Step 2 — Create Feature Branch

```bash
git checkout -b feat/<slug>#<issue-number>
```

## Step 3 — Implement

- **SIMPLE**: read → edit → `npm run build`. Sem subagente.
- **COMPLEX**: delegar ao `@implementer` com o plano aprovado. Deve rodar `npm run build` e reportar arquivos alterados.

## Step 4 — Test (OPTIONAL)

Delegar ao `@tester` apenas se: mudança toca lógica crítica (IPC, state, polling, credentials) ou usuário pediu explicitamente. Pular para mudanças isoladas/UI.

## Step 5 — Commit

```
feat: <short description> (closes #<issue>)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Step 6 — Open Pull Request

```bash
gh pr create \
  --title "feat: <short description>" \
  --body "$(cat <<'EOF'
## Summary
- <bullet>

## Related
Closes #<issue>

## Test plan
- [ ] `npm run build` exits cleanly
- [ ] <manual check>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Compartilhar a URL do PR com o usuário.
