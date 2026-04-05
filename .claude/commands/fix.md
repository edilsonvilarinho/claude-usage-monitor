# /fix — Bug Fix Workflow

Structured workflow optimized for token efficiency.

---

## Step 0 — Assess complexity BEFORE spawning any agent

Read the user's bug report and classify:

**SIMPLE** (root cause is clear, fix is in ≤3 files):
→ Skip Plan Mode and Explore agents. Read the relevant files directly, apply the fix, proceed to Step 1.

**COMPLEX** (root cause is unclear, touches many files, regression risk is high):
→ Use Plan Mode. Launch at most 1 Explore agent to diagnose root cause. Present diagnosis + fix plan. Wait for approval.

> Default to SIMPLE. Most bugs have an obvious root cause once you read the file.

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

Note the issue number (e.g. #7).

---

## Step 2 — Create Fix Branch

```bash
git checkout -b fix/<slug>#<issue-number>
```

---

## Step 3 — Apply Fix

**SIMPLE:** Apply the fix directly (read → edit → build). No subagent needed for small fixes.

**COMPLEX:** Delegate to `@implementer` with root cause and fix plan.

The implementer will:
- Read every file to be modified before changing anything
- Apply the minimal fix — no unrelated cleanup
- Run `npm run build` to confirm clean exit
- Report what changed

---

## Step 4 — Validate (OPTIONAL)

Only delegate to `@tester` if:
- The fix touches complex logic or shared state
- There's a real regression risk
- The user asked for validation

For obvious, isolated fixes: **skip this step**.

---

## Step 5 — Commit

```
fix: <short description> (closes #<issue>)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

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

Share the PR URL with the user.
