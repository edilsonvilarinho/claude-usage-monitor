# /fix — Bug Fix Workflow

Structured workflow: plan → issue → branch → implement → test → PR.

---

## Step 1 — Plan Mode (you, the orchestrator)

Enter plan mode. Present to the user:
- Root cause of the bug
- Files affected
- Proposed minimal fix
- Edge cases or regression risks

**Do NOT proceed until the user approves the plan.**

---

## Step 2 — Create GitHub Issue

```bash
gh issue create \
  --title "fix: <short description>" \
  --label "bug" \
  --body "$(cat <<'EOF'
## Bug Description
<what is wrong>

## Root Cause
<diagnosis from plan>

## Steps to Reproduce
1.
2.

## Expected vs Actual
- **Expected:**
- **Actual:**

## Fix Plan
<key steps from approved plan>
EOF
)"
```

Note the issue number (e.g. #7).

---

## Step 3 — Create Fix Branch

```bash
git checkout -b fix/<slug>#<issue-number>
```

---

## Step 4 — Delegate Fix to @implementer

Hand off to the `implementer` agent with the root cause diagnosis and approved fix plan.

The implementer will:
- Read every file to be modified before changing anything
- Apply the minimal fix — no unrelated cleanup
- Run `npm run build` to confirm clean exit
- Report what changed

---

## Step 5 — Delegate Validation to @tester

After the fix is applied, hand off to the `tester` agent with:
- The original bug description
- The fix that was applied

The tester will:
- Confirm the fix addresses the root cause
- Check for regressions in related code paths
- Produce a manual verification checklist

---

## Step 6 — Commit

```
fix: <short description> (closes #<issue>)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Step 7 — Open Pull Request

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
- [ ] <regression check from tester>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Share the PR URL with the user.
