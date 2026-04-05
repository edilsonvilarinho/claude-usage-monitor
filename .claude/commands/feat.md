# /feat — New Feature Workflow

Structured workflow optimized for token efficiency.

---

## Step 0 — Assess complexity BEFORE spawning any agent

Read the user's request and classify:

**SIMPLE** (≤3 files, user described what to change, no architectural decisions):
→ Skip Plan Mode and Explore agents. Go directly to Step 1.

**COMPLEX** (many files, unclear scope, architectural trade-offs):
→ Use Plan Mode. Launch at most 1 Explore agent (not 2) to understand scope. Present plan and wait for approval before proceeding.

> Default to SIMPLE unless genuinely uncertain. Explore agents and Plan Mode cost ~50-80k tokens combined — only use them when they add real value.

---

## Step 1 — Create GitHub Issue

```bash
gh issue create \
  --title "feat: <short description>" \
  --body "$(cat <<'EOF'
## Summary
<what and why>

## Acceptance Criteria
- [ ] <criterion 1>
- [ ] <criterion 2>
EOF
)"
```

Note the issue number (e.g. #42).

---

## Step 2 — Create Feature Branch

```bash
git checkout -b feat/<slug>#<issue-number>
```

---

## Step 3 — Implement

**SIMPLE:** Implement directly (read files → edit → build). No subagent needed unless the change spans many files.

**COMPLEX:** Delegate to `@implementer` with the approved plan.

The implementer will:
- Read all files to be modified before touching anything
- Apply the changes following the plan
- Run `npm run build` to confirm clean exit
- Report which files changed

---

## Step 4 — Test (OPTIONAL)

Only delegate to `@tester` if:
- The change is risky (touches critical paths, state management, IPC)
- The user explicitly asked for a test checklist
- Automated tests need to be written

For safe, isolated changes (new translations, UI strings, simple helpers): **skip this step**.

---

## Step 5 — Commit

```
feat: <short description> (closes #<issue>)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Step 6 — Open Pull Request

```bash
gh pr create \
  --title "feat: <short description>" \
  --body "$(cat <<'EOF'
## Summary
- <bullet 1>

## Related
Closes #<issue>

## Test plan
- [ ] `npm run build` exits cleanly
- [ ] <manual check>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Share the PR URL with the user.
