# /test — Test Workflow

Workflow estruturado: plan → issue → branch → tester → implementer → commit → PR.
Lead agent é @tester, com @implementer suportando se código de teste precisar ser escrito.

---

## Step 1 — Plan Mode (você, o orquestrador)

Entre no Plan Mode. Apresente ao usuário:
- O que será testado (escopo, qual serviço ou comportamento)
- Tipo de teste: unit, integration, smoke manual, edge cases
- O que está fora do escopo

**NÃO prossiga até o usuário aprovar o plano.**

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
- [ ] <edge case>

## Out of Scope
<what will NOT be tested>
EOF
)"
```

## Step 3 — Create Test Branch

```bash
git checkout -b test/<slug>#<issue-number>
```

## Step 4 — Delegate to @tester

Passar ao `tester` o plano aprovado completo. O tester irá:
- Analisar o código-alvo para todos os cenários testáveis
- Produzir checklist de smoke test manual
- Implementar testes automatizados onde viável (sem chamadas de rede reais, sem timers reais)
- Reportar cobertura e gaps

## Step 5 — Delegate to @implementer (se necessário)

Se o tester identificou código de teste a escrever (novos arquivos de teste, utilitários, mocks), passar ao `implementer` para escrever e conectar. Deve rodar `npm run build`.

## Step 6 — Commit

```
test: <short description> (closes #<issue>)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Step 7 — Open Pull Request

```bash
gh pr create \
  --title "test: <short description>" \
  --body "## Summary\n<what was tested>\n\n## Scenarios Covered\n- <scenario>\n\n## Coverage Gaps\n<gaps>\n\nCloses #<issue>\n\n- [ ] \`npm run build\` exits cleanly\n- [ ] All new tests pass\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Compartilhar a URL do PR com o usuário.
