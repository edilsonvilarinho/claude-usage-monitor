# /fix — Bug Fix Workflow

Workflow estruturado: issue → branch → fix → test → commit → PR.

> **Antes de começar**: SIMPLE (causa raiz clara, ≤3 arquivos) → corrige direto, sem subagentes. COMPLEX (causa incerta, muitos arquivos) → Plan Mode com 1 Explore agent, aguardar aprovação.

---

## Step 1 — Create GitHub Issue

```bash
gh issue create \
  --title "fix: <short description>" \
  --label "bug" \
  --body "$(cat <<'EOF'
## Bug Description
<what is wrong>

## Root Cause
<diagnosis>

## Fix Plan
<what will be changed>
EOF
)"
```

Note o número do issue.

## Step 2 — Create Fix Branch

```bash
git checkout -b fix/<slug>#<issue-number>
```

## Step 3 — Apply Fix

- **SIMPLE**: read → edit → `npm run build`. Sem subagente. Correção mínima, sem cleanup não relacionado.
- **COMPLEX**: delegar ao `@implementer` com causa raiz e plano. Deve rodar `npm run build` e reportar o que mudou.

## Step 4 — Validate (OPTIONAL)

Delegar ao `@tester` apenas se: fix toca lógica complexa ou estado compartilhado, risco real de regressão, ou usuário pediu. Pular para fixes óbvios e isolados.

## Step 5 — Commit

```
fix: <short description> (closes #<issue>)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Step 6 — Open Pull Request

```bash
gh pr create \
  --title "fix: <short description>" \
  --body "$(cat <<'EOF'
## Summary
<what was broken and what changed>

## Root Cause
<brief explanation>

## Related
Closes #<issue>

## Test plan
- [ ] `npm run build` exits cleanly
- [ ] Bug no longer reproduces

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Compartilhar a URL do PR com o usuário.
