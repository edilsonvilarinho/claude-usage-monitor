# /hotfix — Hotfix Workflow (Critical / Production)

For critical bugs that need to go directly to `master`. Speed matters, but correctness still comes first.

---

## Step 1 — Plan Mode (you, the orchestrator)

Enter plan mode. Confirm:
- This is a critical issue (crash, data loss, security, broken core feature)
- Exact root cause
- The minimal fix — no refactoring, no extras
- Regression risk

**Do NOT proceed until the user approves the plan.**

---

## Step 2 — Create GitHub Issue (urgent)

```bash
gh issue create \
  --title "hotfix: <short description>" \
  --label "bug" \
  --body "$(cat <<'EOF'
## Critical Issue
<what is broken and why it is urgent>

## Root Cause
<diagnosis>

## Fix
<minimal change planned>
EOF
)"
```

---

## Step 3 — Create Hotfix Branch from master

```bash
git checkout master && git pull origin master
git checkout -b hotfix/<slug>#<issue-number>
```

---

## Step 4 — Delegate Fix to @implementer

Hand off to the `implementer` agent with the approved minimal fix.

The implementer will:
- Apply only the exact change needed — nothing else
- Run `npm run build` — must exit cleanly
- Report what changed

---

## Step 5 — Delegate Quick Validation to @tester

Hand off to the `tester` agent for a fast focused check:
- Does the fix address the root cause?
- Any immediate regression risk?
- Minimal smoke test checklist (keep it short — this is a hotfix)

---

## Step 6 — Commit

```
hotfix: <short description> (closes #<issue>)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Step 7 — Open PR targeting master

```bash
gh pr create \
  --base master \
  --title "hotfix: <short description>" \
  --body "$(cat <<'EOF'
## Hotfix
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
- [ ] <quick regression check from tester>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Inform the user: after merge, run `/release patch` to cut a patch version.
