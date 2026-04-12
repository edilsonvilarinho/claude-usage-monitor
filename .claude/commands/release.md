# /release — Release Workflow

Cria uma versão: bump, build, tag e GitHub Release com assets.

> Fluxo mecânico — sem Plan Mode, sem subagentes.

## Usage

```
/release patch   # 1.1.0 → 1.1.1  (bug fixes)
/release minor   # 1.1.0 → 1.2.0  (new features)
/release major   # 1.1.0 → 2.0.0  (breaking changes)
```

Se não informado, perguntar o tipo antes de prosseguir.

---

## Step 1 — Confirm current state

```bash
git status && git log --oneline -5
```

`master` deve estar limpo e atualizado com origin. Se não, parar e informar.

## Step 2 — Bump version in package.json

Ler versão atual, calcular nova, atualizar com Edit tool.

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

Se falhar, parar — não criar tag nem release com build quebrado. Verificar que `dist-build/` tem ambos EXEs em ~70–90 MB.

## Step 5 — Create annotated git tag

```bash
git tag -a v<new-version> -m "v<new-version>"
```

## Step 6 — Push commit and tag

```bash
git push origin master && git push origin v<new-version>
```

## Step 7 — Collect changelog

```bash
git log $(git describe --tags --abbrev=0 HEAD^)..HEAD --oneline
```

Agrupar por tipo: `feat`, `fix`, `hotfix`, `chore`.

## Step 8 — Create GitHub Release with assets

```bash
gh release create v<new-version> \
  "dist-build/Claude Usage Monitor Setup <version>.exe" \
  "dist-build/Claude Usage Monitor <version>.exe" \
  --title "v<new-version>" \
  --notes "## What's Changed\n\n### Features\n- ...\n\n### Bug Fixes\n- ...\n\n**Full changelog:** https://github.com/edilsonvilarinho/claude-usage-monitor/compare/v<prev>...v<new>"
```

Compartilhar a URL do GitHub Release. Se `npm run dist` falhar por permissões de symlink, pedir para rodar como Administrador.
