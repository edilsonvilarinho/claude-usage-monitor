# /release — Release Workflow

Creates a versioned release: bumps version, builds executables, creates git tag, and publishes a GitHub Release with assets.

## Usage

```
/release patch   # 1.1.0 → 1.1.1  (bug fixes)
/release minor   # 1.1.0 → 1.2.0  (new features)
/release major   # 1.1.0 → 2.0.0  (breaking changes)
```

If no argument is given, ask the user which bump type to use before proceeding.

---

## Step 1 — Confirm current state

```bash
git status
git log --oneline -5
```

Confirm that `master` is clean (no uncommitted changes) and up to date with origin. If not, stop and inform the user.

## Step 2 — Bump version in package.json

Read the current version from `package.json`, compute the new version based on the bump type, and update it:

```json
"version": "<new-version>"
```

## Step 3 — Commit version bump

```bash
git add package.json
git commit -m "chore: bump version to v<new-version>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

## Step 4 — Build executables

```bash
npm run dist
```

If the build fails, stop and report the error. Do NOT create a tag or release with a failed build.

Confirm that `dist/` contains the expected files:
- `Claude Usage Monitor Setup <version>.exe` (NSIS installer)
- `Claude Usage Monitor <version>.exe` (portable)

## Step 5 — Create annotated git tag

```bash
git tag -a v<new-version> -m "v<new-version>"
```

## Step 6 — Push commit and tag

```bash
git push origin master
git push origin v<new-version>
```

## Step 7 — Collect changelog

Look at commits since the previous tag to build the release notes:

```bash
git log $(git describe --tags --abbrev=0 HEAD^)..HEAD --oneline
```

Group them by type: `feat`, `fix`, `hotfix`, `chore`.

## Step 8 — Create GitHub Release with assets

Use the full paths to the EXE files (glob may not work in all shells on Windows):

```bash
gh release create v<new-version> \
  "dist/Claude Usage Monitor Setup <version>.exe" \
  "dist/Claude Usage Monitor <version>.exe" \
  --title "v<new-version>" \
  --notes "$(cat <<'EOF'
## What's Changed

### Features
- ...

### Bug Fixes
- ...

### Other
- ...

---
**Full changelog:** https://github.com/edilsonvilarinho/claude-usage-monitor/compare/v<prev-version>...v<new-version>
EOF
)"
```

## Step 9 — Report

Share the GitHub Release URL with the user.

> Note: If `npm run dist` fails due to symlink permissions on Windows, ask the user to run the terminal as Administrator and retry `/release`.
