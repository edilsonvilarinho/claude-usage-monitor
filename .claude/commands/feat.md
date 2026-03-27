# /feat — New Feature Workflow

You are helping implement a new feature using a structured plan → issue → branch → code → PR workflow.

## Step 1 — Enter Plan Mode

Before writing any code, enter plan mode and present a clear implementation plan:

- What will be built (scope)
- Which files will be created or modified
- Any architectural decisions or trade-offs
- Acceptance criteria

Do NOT proceed until the user approves the plan.

## Step 2 — Create GitHub Issue

After plan approval, create a GitHub issue documenting the feature:

```bash
gh issue create \
  --title "feat: <short description>" \
  --body "$(cat <<'EOF'
## Summary
<what and why>

## Acceptance Criteria
- [ ] <criterion 1>
- [ ] <criterion 2>

## Implementation Plan
<key steps from approved plan>
EOF
)"
```

Note the issue number (e.g. #42).

## Step 3 — Create Feature Branch

```bash
git checkout -b feat/<slug>#<issue-number>
# Example: feat/auto-refresh#42
```

## Step 4 — Implement

Execute the approved plan. Run `npm run build` after changes and confirm clean exit before moving on.

## Step 5 — Commit

Stage only relevant files. Commit message format:

```
feat: <short description> (closes #<issue>)

<optional body>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Step 6 — Open Pull Request

```bash
gh pr create \
  --title "feat: <short description>" \
  --body "$(cat <<'EOF'
## Summary
- <bullet 1>
- <bullet 2>

## Related
Closes #<issue>

## Test plan
- [ ] `npm run build` exits cleanly
- [ ] Manual smoke test in tray

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Share the PR URL with the user.
