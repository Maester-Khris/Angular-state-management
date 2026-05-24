# /execute-task

Execute a defined task from the `.agent/tasks/` folder with planning, implementation, and a clean git commit.

## Invocation
/execute-task <task-filename>
example: /execute-task wire-writer-console-post-crud-to-live-api.md

---

## Step 1 — Read the Task

Read `.agent/tasks/<task-filename>` in full before doing anything else.
If the file does not exist, stop and report:
`⛔ Task file not found: .agent/tasks/<task-filename>`

---

## Step 2 — Load Context

Before writing the plan, read the key repo files to build an accurate picture of the
codebase. Skip any file already present in the current context window.

### Always read (if not already in context)

- `.agent/AGENTS.md`
- `CLAUDE.md`
- `CHANGELOG.md`
- `feature-flags.json`

### Read conditionally based on task scope

| Task touches | Also read |
|---|---|
| `node-backend/` | `node-backend/CLAUDE.md`, `node-backend/server.js`, `node-backend/routing/` listing |
| `ng-frontend/` | `ng-frontend/CLAUDE.md`, `ng-frontend/src/app/app.routes.ts` |
| `python-search-api/` | `python-search-api/CLAUDE.md`, `python-search-api/app.py` |
| `data-utils/` | `data-utils/unified_seeder.py` |
| Any file explicitly listed in task | Read that file in full before planning changes to it |
| Auth or middleware | `node-backend/middleware/auth.js` |
| Database | `node-backend/database/crud.js` |

### Confirm what was loaded

After reading, output one line:

Context loaded: AGENTS.md, CLAUDE.md, CHANGELOG.md, [+ any extras read]

If a key file is missing:
⚠️ <filename> not found — will flag in plan if relevant.

---

## Step 3 — Plan

Write a structured execution plan. Do not write any code yet.

### Plan format
Plan: <task name>
Context notes
One or two sentences on what the loaded files revealed that shapes this plan.
Call out any conflict between the task description and what the codebase actually contains.
Files to create

<path> — <one line reason>

Files to modify

<path> — <one line reason>

Files that will NOT be touched


<anything adjacent that might seem relevant but is out of scope>


API contract impact
Does this task add or change any endpoint?
→ YES: describe exact method, path, request shape, response shape.
→ NO: state "No contract changes."
Feature flag impact
Does this task require a new or updated entry in feature-flags.json?
→ YES: describe the flag name, status, modules, enabled_prod value.
→ NO: state "No flag changes."
Open questions
Anything genuinely ambiguous before proceeding.
If none, write "None — proceeding."

**Stop after writing the plan. Wait for approval.**
A simple "go", "yes", or "looks good" is sufficient.
If the user modifies the plan, revise and wait again before implementing.

---

## Step 4 — Implement

Execute the approved plan step by step.

Rules during implementation:
- Follow conventions in `AGENTS.md` and the relevant `CLAUDE.md` per package
- TypeScript: no implicit `any`, all shapes typed against existing interfaces in
  `writer.models.ts`, `post.model.ts`, or `remote-api.ts` — do not invent new ones
- Node: use existing middleware (`authenticateJWT`) — do not add per-route auth
  where `router.use(authenticateJWT)` already covers the router
- Angular: use `environment.nodeServiceUrl` as base URL — never hardcode
- If a new env var is needed: add to `node-backend/.env.example` before using it
- If a new package is needed: note it explicitly, add to the correct
  `package.json` or `requirements.txt`
- Never hardcode secrets, API keys, or credentials
- If a necessary change falls outside the approved scope: stop, flag it,
  do not proceed silently

---

## Step 5 — Tests (conditional)

Run only if the task file specifies `Tests required: yes` or the user requests it.

```bash
# Node
cd node-backend && doppler run -- npm run test

# Angular
cd ng-frontend && npm run test -- --watch=false

# Python
cd python-search-api && doppler run -- pytest tests/
```

Do not commit if tests are failing. Fix first, then proceed to Step 6.

---

## Step 6 — Outcome Summary
Outcome: <task name>
Done:             <one sentence per completed item>
Files changed:    <explicit list with package prefix e.g. node-backend/routing/activity.js>
Contract changes: <yes/no — if yes, describe endpoint and shape>
Flag changes:     <yes/no — if yes, describe>
Packages added:   <list or "none">
Deferred:         <anything from the task not done, and why>
Known issues:     <anything to flag for follow-up, or "none">

---

## Step 7 — Git Commit

### 7a — Branch check

```bash
git branch --show-current
```

**If the result is `main` or `preview`:**
Stop immediately. Do not stage or commit anything.
Report:
⛔ On protected branch '<branch>'. Create a feature branch first:
git checkout -b feat/<short-description>

**If the branch is safe:** proceed to 7b.

### 7b — Stage explicitly

```bash
# Name every file — never use git add . or git add -A
git add <file1> <file2> ...

# Review before committing
git diff --staged --stat
```

### 7c — Commit

```bash
git commit -m "<type>(<scope>): <short description>"
```

Commit message rules:
- **Type:** `feat` | `fix` | `chore` | `docs` | `refactor` | `test`
- **Scope:** package name — `ng-frontend` | `node-backend` | `python-search-api` | `data-utils` | `docs` | `agents`
- **Description:** lowercase, imperative mood, no trailing period, max 72 chars

Good examples:
feat(node-backend): add GET /myactivity/posts for writer feed
fix(ng-frontend): correct createPost URL to /myactivity/posts
refactor(node-backend): extend userPosts select with WriterPost fields
chore(agents): update task log after crud wiring run

**Never:**
- Add an AI assistant as git co-author
- Use `git add .` or `git add -A`
- Push — commit only, pushing is the developer's responsibility

---

## Hard Stops

| Condition | Report |
|---|---|
| Task file not found | `⛔ Task file not found: .agent/tasks/<filename>` |
| Current branch is `main` or `preview` | `⛔ On protected branch. Create a feature branch first.` |
| Required change falls outside approved plan | `⛔ Out-of-scope change required. Flagging before proceeding.` |
| API key or secret pattern found in staged files | `⛔ Potential secret in staged files. Aborting commit.` |
| Existing test suite broken by changes | `⛔ Tests failing. Fix before committing.` |