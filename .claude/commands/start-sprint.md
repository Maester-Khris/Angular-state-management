# /start-sprint

Cut a new branch from `preview`, push it to set up remote tracking, and seed
`CHANGELOG.md` with the sprint's scope as the branch's first commit.

## Invocation
```
/start-sprint <short-description>
```
`<short-description>` becomes the branch suffix (kebab-case, matches `CLAUDE.md`'s
`type/short-description` branch convention). Infer the `type` prefix
(`feat`|`fix`|`chore`|`refactor`|`docs`|`test`) from what the sprint's scope actually
is — default to `feat` if it introduces new capability across services.

---

## Step 1 — Preflight

```bash
git branch --show-current
git status --short
git fetch origin main preview
git log origin/main..origin/preview --oneline
git log origin/preview..origin/main --oneline
```

**If `git status --short` shows uncommitted changes:** stop.
```
⛔ Uncommitted changes present on '<branch>'. Commit or stash first.
```

**If `preview` is BEHIND `main`** (`origin/preview..origin/main` is non-empty — main
has commits preview lacks): stop. Preview is stale relative to production and must
be fast-forwarded first (same operation as `/end-sprint` Step 6):
```
⛔ preview is behind main by N commit(s) — fast-forward preview before starting
a new sprint:
git checkout preview && git merge main && git push origin preview
```

**If `preview` is AHEAD of `main`** (docs/process commits, or merged-but-not-yet-
released work): expected per this repo's branch strategy — `preview` leads, `main`
catches up via PR. Report the gap for visibility, then proceed — this is not a stop
condition.

---

## Step 2 — Create the branch from preview

```bash
git checkout preview
git pull origin preview
git checkout -b <type>/<short-description> preview
```

---

## Step 3 — Push and set upstream tracking

```bash
git push -u origin <type>/<short-description>
```

Establishes the branch on `origin` so plain `git push`/`git pull` work for the rest
of the sprint without re-specifying `-u origin <branch>`.

---

## Step 4 — Seed CHANGELOG.md with the sprint's scope

Read `CHANGELOG.md`'s existing format before writing anything — most recent entry
first, `## [Name] — Date — Status`, `**Theme: ...**`, service-scoped `### Completed`/
`### Deferred` checklists (any prior entry shows the exact shape). Insert a new entry
at the **top** of the file:

```markdown
## [<Sprint Name>] — <YYYY-MM-DD> — In Progress
**Theme: <one-line theme>**

### Scope
- [ ] `<service>` — <planned item>
...

### Reference
- <links to any planning/audit docs produced this session, e.g. artifacts/...>
```

Scope bullets come from whatever was actually agreed in this session (a plan, an
audit, a discussion) — never invent scope that wasn't discussed. Each bullet keeps
the same `` `service` `` prefix convention as commit scopes
(`ng-frontend`/`node-backend`/`python-search-api`/`data-utils`/`agents`). Status is
`In Progress` — nothing in a `### Scope` section is checked off yet; this entry gets
its `[x]` boxes filled in by later commits during the sprint, not by this command.

---

## Step 5 — Commit

```bash
git add CHANGELOG.md
git diff --staged --stat
git commit -m "docs(agents): scope <sprint-name> sprint in changelog"
```

Per `CLAUDE.md` hygiene: name the file explicitly (never `git add -A`), review the
staged diff before committing. Do not push again after this commit — `/end-sprint`
handles the push when the sprint's actual work is ready to go up.

---

## Hard stops

| Condition | Action |
|---|---|
| Uncommitted changes present | `⛔ Uncommitted changes present. Commit or stash first.` |
| `preview` is behind `main` | `⛔ preview is behind main — fast-forward before starting a new sprint.` |
| `CHANGELOG.md`'s existing format doesn't match what's expected | Stop and ask rather than guessing a new format |
