# /hotfix — Hotfix Workflow (Critical / Production)

Use this for critical bugs that need to go directly to `master` without a long-lived branch review cycle.

## Step 1 — Enter Plan Mode

Before any code change, enter plan mode:

- Confirm this is a critical issue (data loss, crash, security, broken core feature)
- Identify the exact root cause
- Propose the minimal fix (no refactoring, no extras)
- Identify risk of regression

Do NOT proceed until the user approves the plan.

## Step 2 — Create GitHub Issue (urgent)

```bash
gh issue create \
  --title "hotfix: <short description>" \
  --label "bug" \
  --body "$(cat <<'EOF'
## 🚨 Critical Issue
<what is broken and why it's urgent>

## Root Cause
<diagnosis>

## Fix
<minimal change planned>
EOF
)"
```

## Step 3 — Create Hotfix Branch from master

```bash
git checkout master
git pull origin master
git checkout -b hotfix/<slug>#<issue-number>
```

## Step 4 — Implement Minimal Fix

Apply only what is needed. No cosmetic changes. Run `npm run build` — must exit cleanly.

## Step 5 — Commit

```
hotfix: <short description> (closes #<issue>)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Step 6 — Open PR targeting master

```bash
gh pr create \
  --base master \
  --title "hotfix: <short description>" \
  --body "$(cat <<'EOF'
## 🚨 Hotfix
<what broke and what was fixed>

## Root Cause
<brief>

## Risk Assessment
- Minimal change: yes/no
- Regression risk: low/medium/high

## Related
Closes #<issue>

## Test plan
- [ ] `npm run build` exits cleanly
- [ ] Issue no longer reproduces
- [ ] No regression observed

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Inform the user: after merge, run `/release` to cut a patch version.
