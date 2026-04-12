# /hotfix — Hotfix Workflow (Critical / Production)

Para bugs críticos que vão direto para `master`. Velocidade importa, mas correção vem primeiro.

---

## Step 1 — Plan Mode (você, o orquestrador)

Entre no Plan Mode. Confirme:
- Este é um problema crítico (crash, perda de dados, segurança, feature core quebrada)
- Causa raiz exata
- Fix mínimo — sem refatoração, sem extras
- Risco de regressão

**NÃO prossiga até o usuário aprovar o plano.**

---

## Step 2 — Create GitHub Issue

```bash
gh issue create \
  --title "hotfix: <short description>" \
  --label "bug" \
  --body "$(cat <<'EOF'
## Critical Issue
<what is broken and why urgent>

## Root Cause
<diagnosis>

## Fix
<minimal change planned>
EOF
)"
```

## Step 3 — Create Hotfix Branch from master

```bash
git checkout master && git pull origin master
git checkout -b hotfix/<slug>#<issue-number>
```

## Step 4 — Delegate Fix to @implementer

Passar ao `implementer` o fix mínimo aprovado. Deve aplicar apenas a mudança exata, rodar `npm run build` e reportar o que mudou.

## Step 5 — Delegate Quick Validation to @tester

Passar ao `tester` para check rápido e focado: fix endereça a causa raiz? Risco imediato de regressão? Checklist mínimo de smoke test.

## Step 6 — Commit

```
hotfix: <short description> (closes #<issue>)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Step 7 — Open PR targeting master

```bash
gh pr create --base master \
  --title "hotfix: <short description>" \
  --body "## Hotfix\n<what broke and what was fixed>\n\n## Root Cause\n<brief>\n\n## Risk\n- Minimal change: yes/no — Regression: low/medium/high\n\nCloses #<issue>\n\n- [ ] \`npm run build\` exits cleanly\n- [ ] Issue resolved\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Informar: após o merge, rodar `/release patch`.
