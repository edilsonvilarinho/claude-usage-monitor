# /feat — New Feature Workflow

Structured workflow: plan → issue → branch → implement → test → PR.

---

## Step 1 — Plan Mode (you, the orchestrator)

Enter plan mode. Present to the user:
- What will be built (scope and acceptance criteria)
- Which files will be created or modified
- Any architectural decisions or trade-offs

**Do NOT proceed until the user approves the plan.**

---

## Step 2 — Create GitHub Issue

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

---

## Step 3 — Create Feature Branch

```bash
git checkout -b feat/<slug>#<issue-number>
```

---

## Step 4 — Delegate Implementation to @implementer

Hand off to the `implementer` agent with the full approved plan and issue number.

The implementer will:
- Read all files to be modified before touching anything
- Apply the changes following the plan
- Run `npm run build` to confirm clean exit
- Report which files changed

---

## Step 5 — Delegate Testing to @tester

After implementation is confirmed, hand off to the `tester` agent.

The tester will:
- Analyze the new code for testable scenarios and edge cases
- Produce a manual smoke test checklist
- Implement automated tests if feasible
- Report coverage gaps

---

## Step 6 — Commit

```
feat: <short description> (closes #<issue>)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Step 7 — Open Pull Request

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
- [ ] <scenario from tester checklist>
- [ ] <scenario from tester checklist>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Share the PR URL with the user.
