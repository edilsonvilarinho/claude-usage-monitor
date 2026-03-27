# /test — Test Workflow

You are helping add or improve tests using a structured plan → issue → branch → code → PR workflow.

## Step 1 — Enter Plan Mode

Before writing any code, enter plan mode and present a clear test plan:

- What will be tested (unit, integration, e2e, manual smoke)
- Which files will be created or modified
- What scenarios/edge cases will be covered
- What tooling or setup is needed (if any)

Do NOT proceed until the user approves the plan.

## Step 2 — Create GitHub Issue

After plan approval, create a GitHub issue to track the test work:

```bash
gh issue create \
  --title "test: <short description>" \
  --label "testing" \
  --body "$(cat <<'EOF'
## Summary
<what is being tested and why>

## Scenarios to Cover
- [ ] <scenario 1>
- [ ] <scenario 2>
- [ ] <edge case>

## Out of Scope
<what will NOT be tested in this task>

## Implementation Plan
<key steps from approved plan>
EOF
)"
```

Note the issue number (e.g. #15).

## Step 3 — Create Test Branch

```bash
git checkout -b test/<slug>#<issue-number>
# Example: test/polling-rate-limit#15
```

## Step 4 — Implement

Execute the approved plan. Run `npm run build` after changes and confirm clean exit. If tests are runnable, execute them and confirm all pass.

## Step 5 — Commit

```
test: <short description> (closes #<issue>)

<optional: what scenarios are now covered>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Step 6 — Open Pull Request

```bash
gh pr create \
  --title "test: <short description>" \
  --body "$(cat <<'EOF'
## Summary
<what was tested and how>

## Scenarios Covered
- <scenario 1>
- <scenario 2>
- <edge case>

## Related
Closes #<issue>

## Test plan
- [ ] `npm run build` exits cleanly
- [ ] All new tests pass
- [ ] No regression in existing functionality

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Share the PR URL with the user.
