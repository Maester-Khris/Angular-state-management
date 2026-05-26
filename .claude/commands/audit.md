```markdown
# /audit

Audit the repository, a specific service, or a specific feature to produce
an accurate picture of what is done, what is partial, and what is not started.

## Invocation
```
/audit                                    — full repo audit
/audit <service>                          — single service audit
/audit <service> <feature>               — specific feature audit

# Examples:
/audit
/audit ng-frontend
/audit ng-frontend writer-profile
/audit node-backend writer-console
```

---

## Step 1 — Determine audit scope

Parse the invocation arguments:
- No args → audit all four packages: `ng-frontend`, `node-backend`,
  `python-search-api`, `data-utils`
- One arg → audit that package only
- Two args → audit that feature within that package

---

## Step 2 — Load context

Read in this order before scanning anything:

```
CHANGELOG.md          — source of truth for what was planned vs completed
ROADMAP.md            — what is deferred or upcoming
feature-flags.json    — what is gated, shipped, or pending
.agent/AGENTS.md      — service boundaries and conventions
```

For each package in scope, also read:
```
<package>/CLAUDE.md   — if it exists
```

Confirm loaded context in one line:
```
Context loaded: CHANGELOG.md, ROADMAP.md, feature-flags.json, AGENTS.md [+ extras]
```

---

## Step 3 — Scan

Run the following scans based on scope. Do not skip scans — each one feeds
a different section of the audit output.

### Always run (any scope)

```bash
# 1. Current branch and unmerged work
git branch --show-current
git log main..HEAD --oneline

# 2. Uncommitted changes
git status --short
```

### ng-frontend scans

```bash
# Components and features present on disk
find ng-frontend/src/app/features -type d | sort
find ng-frontend/src/app/features -name "*.ts" | sort

# Mock API still in use — identifies what is not yet wired to live API
grep -r "mockApi\|MockApi\|getMock" ng-frontend/src --include="*.ts" -n \
  --exclude-dir=node_modules

# TODO / stubs / hardcoded data
grep -r "TODO\|FIXME\|stub\|hardcoded\|placeholder" \
  ng-frontend/src/app/features --include="*.ts" -n

# Routes defined
cat ng-frontend/src/app/app.routes.ts

# Auth guard coverage
grep -r "canActivate\|authGuard" ng-frontend/src --include="*.ts" -n
```

### node-backend scans

```bash
# All routes registered
grep -r "router\.\(get\|post\|put\|delete\|patch\)" \
  node-backend/routing --include="*.js" -n

# Routes mounted in server.js
grep -r "app\.use\|router" node-backend/server.js

# DAO methods available
grep -r "async " node-backend/database/crud.js -n

# Tests present
find node-backend/tests -name "*.test.js" | sort
```

### Feature-specific scans (when <feature> arg is provided)

```bash
# Find all files related to the feature
find ng-frontend/src -type f -name "*.ts" | \
  xargs grep -l "<feature>" 2>/dev/null

find node-backend -type f -name "*.js" | \
  xargs grep -l "<feature>" 2>/dev/null \
  --exclude-dir=node_modules

# Check if feature uses mock or live data
grep -r "mockApi\|getMock\|hardcoded" \
  ng-frontend/src/app/features/<feature-dir> --include="*.ts" -n 2>/dev/null

# Check if corresponding Node endpoints exist
grep -r "router\." node-backend/routing --include="*.js" -n | \
  grep -i "<feature>"
```

### python-search-api scans (if in scope)

```bash
# Routes registered
grep -r "@app\.route\|@.*\.route" python-search-api --include="*.py" -n \
  --exclude-dir=.venv

# Services present
find python-search-api/services -name "*.py" | sort
```

---

## Step 4 — Produce audit report

Output a structured report. Never skip a section.
Mark every item with one of: ✅ Done | ⚠️ Partial | ❌ Not started | 🔒 Behind flag

### Report format

```
# Audit Report — <scope> — <date>

## Source of truth
Sprint:   [current sprint from CHANGELOG]
Branch:   [current branch]
Ahead of main: [N commits — list them or "none"]
Uncommitted:   [N files or "clean"]

---

## Feature inventory

| Feature | Layer | Status | Evidence |
|---|---|---|---|
| <feature name> | ng-frontend | ✅ Done | commit ref or file confirmed |
| <feature name> | node-backend | ⚠️ Partial | what works / what is missing |
| <feature name> | ng-frontend | ❌ Not started | no file found |
| <feature name> | ng-frontend | 🔒 Behind flag | flag name, enabled_prod value |

---

## Mock API audit (ng-frontend)

List every component still consuming MockApi or getMock*:

| Component | Mock method used | Live endpoint exists? |
|---|---|---|
| <component> | mockApi.fetchX() | ✅ Yes — GET /api/x |
| <component> | mockApi.fetchY() | ❌ No endpoint yet |

---

## Node endpoint audit

List every route confirmed in routing/ files:

| Method | Path | Auth gated | DAO method | Test exists |
|---|---|---|---|---|
| GET | /myactivity/posts | ✅ | userPosts() | ✅ |
| POST | /myactivity/upload | ✅ | createMediaRecord() | ❌ |

---

## Feature flag audit

| Flag | Status | enabled_prod | Implemented |
|---|---|---|---|
| FOCUS_MODE | shipped | true | ✅ |
| RAG_SEARCH | in_progress | false | ⚠️ |

---

## Gap summary

### Must fix before next sprint
- [ ] <item> — <reason>

### Deferred (already in ROADMAP/backlog)
- [ ] <item> — sprint or backlog reference

### Not in any plan yet (newly discovered)
- [ ] <item> — <evidence>

---

## Recommended next actions
1. <highest priority gap>
2. <second priority>
3. <third priority>
```

---

## Hard stops

| Condition | Action |
|---|---|
| CHANGELOG.md not found | `⛔ CHANGELOG.md missing — cannot determine planned vs completed scope` |
| Package directory not found | `⛔ Package <name> not found in repo root` |
| Feature name matches no files | `⚠️ No files found for feature "<name>" — check spelling or use /audit <service> to list all features` |

---

## Notes

- Never guess status from memory — every status must be backed by a scan result
  or an explicit CHANGELOG entry
- If a file is in CHANGELOG as completed but not found on disk, mark ⚠️ Partial
  and note the discrepancy
- Mock API usage always overrides a "Done" status — if MockApi is still injected,
  the feature is at most ⚠️ Partial regardless of what CHANGELOG says
- Do not modify any file during an audit run
```