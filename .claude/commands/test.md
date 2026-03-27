# /test — Test Workflow

Structured workflow: plan → issue → branch → implement → PR.
Lead agent is @tester, with @implementer supporting if test code needs to be written.

---

## Step 1 — Plan Mode (you, the orchestrator)

Enter plan mode. Present to the user:
- What will be tested (scope, which service or behavior)
- Type of testing: unit, integration, manual smoke, edge cases
- What tooling or setup is needed
- What is explicitly out of scope

**Do NOT proceed until the user approves the plan.**

---

## Step 2 — Create GitHub Issue

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

## Plan
<key steps from approved plan>
EOF
)"
```

Note the issue number.

---

## Step 3 — Create Test Branch

```bash
git checkout -b test/<slug>#<issue-number>
```

---

## Step 4 — Delegate to @tester

Hand off to the `tester` agent with the full approved plan.

The tester will:
- Analyze the target code for all testable scenarios
- Produce a concrete manual smoke test checklist
- Implement automated tests where feasible (no real network calls, no real timers)
- Report what is covered and what gaps remain

---

## Step 5 — Delegate implementation to @implementer (if needed)

If the tester identified test code to be written (new test files, test utilities, mocks), hand off to the `implementer` agent to write and wire it up.

The implementer will run `npm run build` to confirm nothing broke.

---

## Step 6 — Commit

```
test: <short description> (closes #<issue>)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Step 7 — Open Pull Request

```bash
gh pr create \
  --title "test: <short description>" \
  --body "$(cat <<'EOF'
## Summary
<what was tested and how>

## Scenarios Covered
- <scenario 1>
- <scenario 2>

## Coverage Gaps
<what still needs manual verification or future automation>

## Related
Closes #<issue>

## Test plan
- [ ] `npm run build` exits cleanly
- [ ] All new tests pass
- [ ] Manual checklist verified

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Share the PR URL with the user.
