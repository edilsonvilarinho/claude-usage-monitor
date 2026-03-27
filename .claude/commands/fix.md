# /fix — Bug Fix Workflow

You are helping fix a bug using a structured plan → issue → branch → code → PR workflow.

## Step 1 — Enter Plan Mode

Before writing any code, enter plan mode and present a diagnosis and fix plan:

- Root cause of the bug
- Files affected
- Proposed fix approach
- Any edge cases to consider

Do NOT proceed until the user approves the plan.

## Step 2 — Create GitHub Issue

After plan approval, create a GitHub issue to track the bug:

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

## Step 3 — Create Fix Branch

```bash
git checkout -b fix/<slug>#<issue-number>
# Example: fix/rate-limit-header#7
```

## Step 4 — Implement the Fix

Execute the approved plan. Keep the fix minimal — do not refactor unrelated code. Run `npm run build` and confirm clean exit.

## Step 5 — Commit

```
fix: <short description> (closes #<issue>)

<optional: explain why the fix works>

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
- [ ] No regression in related functionality

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Share the PR URL with the user.
