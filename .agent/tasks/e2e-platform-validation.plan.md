---
generated: 2026-08-06
source: (originated from conversation — Trigger B, no prior task file)
phases: 7
---

# Plan — E2E Platform Validation (pure-CLI Playwright, no LLM in execution)

> **STATUS: ✅ COMPLETE (2026-08-06)** — all phases executed, 9/9 tests passing.
> See `.agent/tasks/e2e-platform-validation.exec.md` for the full run-by-run log.
> One real production bug found and left unfixed by explicit choice (Google Identity
> crash in `auth-service.ts`) — see exec.md Run 4 / Run 9.

## Scope confirmation

Validate the full platform end-to-end — reader view, writer console, writer dashboard,
and the cross-service integration seams flagged in `docs/testing/e2e-scope-mapping.md` —
via a real, deterministic Playwright suite run from the CLI. No LLM drives the browser at
execution time (per `docs/research/2026-08-06-llm-agent-e2e-testing.md`'s finding: agent
may assist *authoring*, CI executes plain Playwright). Starts at test-account creation,
ends at a full headless CLI run whose results decide what comes next — this plan does not
itself decide "ship or don't," it produces the signal to decide from.

Each phase is a separate session-resumable checkpoint (see companion `.exec.md`) — do not
chain phases in one sitting; verify and log each before advancing.

## Files inventory

| Action | File | Reason |
|--------|------|--------|
| CREATE | `data-utils/seed_e2e_account.py` | Phase 0 — standalone seed script, matches dir's Python convention |
| CREATE | `e2e/package.json`, `e2e/playwright.config.ts` | Phase 1 — new top-level Playwright workspace |
| CREATE | `e2e/.env.example` | Phase 1 — BASE_URL + test-account env var documentation |
| CREATE | `e2e/tests/auth.spec.ts` | Phase 2 |
| CREATE | `e2e/tests/reader.spec.ts` | Phase 3 |
| CREATE | `e2e/tests/writer-console.spec.ts` | Phase 4 |
| CREATE | `e2e/tests/writer-profile.spec.ts` | Phase 5 |
| MODIFY | `.agent/CLAUDE.md` (root) | Phase 1 — add `e2e/` to the services/ports table once scaffolded |

## Files that must not change

- No production route, model, or service files — this is a black-box suite hitting
  already-deployed/running endpoints, not a code-change task
- Do not touch `node-backend/tests/*` (Vitest suite) — separate concern, already green

## Service boundaries crossed

None new — the suite only ever talks to the same public surface real users hit
(Angular → Node → Python), same as production traffic. No direct Python/Mongo access
from the browser side.

## Missing context (must resolve before Phase 1)

1. **Target environment for this pass — RESOLVED for Phase 0/1: local dev stack.** A
   `node-backend` dev server (`dev_nk` config) was already running and confirmed healthy
   during Phase 0 (`/health` → Mongo Atlas connected, Python search connected) — used
   directly rather than started fresh. `ng-frontend`'s dev server (`ng serve`) is not yet
   confirmed running; Phase 1/2 needs to start it or confirm it's up before pointing
   Playwright's `BASE_URL` at `http://localhost:4200`. Original options were: (a) local dev
   stack (chosen), or (b) the live `preview` branch deployment (Angular+Node on Vercel —
   Python search-api's Railway URL for that deployment is unknown, can't be guessed, so
   this remains the fallback only if local orchestration proves unworkable).
   data — flag before Phase 1 if you want the preview URL instead.
2. **Media upload / Cloudinary boundary** (affects Phase 4 scope only): mock the upload at
   the network layer, or accept real Cloudinary calls against a disposable test preset?
   Defaulting to **excluded from this pass** (cover the non-media CRUD path first) unless
   told otherwise — real Cloudinary calls in an automated suite are a cost/flakiness
   tradeoff that deserves its own decision, not a default.
3. **Signup+OTP flow**: real email OTP can't be automated without an inbox-reading hook.
   Defaulting to **out of scope for this pass** — Phase 0 seeds an already-verified account,
   Phase 2 covers login only. Signup+OTP as its own E2E flow is a follow-up if wanted.

## Phase breakdown

### Phase 0 — Test account creation — ✅ DONE (Run 1, 2026-08-06)
Goal: one persistent, real, login-capable writer account seeded in MongoDB.
Files: `data-utils/seed_e2e_account.py` (Python, not `.js` — see deviation note below)
Approach: standalone Python script (matches this directory's actual established
convention — `bcrypt` already pinned in `requirements.txt`, every existing seed/backfill
script here is Python + pymongo), using the **`dev_nk`** Doppler config
(`doppler run --project postair --config dev_nk -- python3 seed_e2e_account.py`).
**Corrected from the original assumption**: the plan originally said "the same `test`
Doppler config the existing Vitest integration tests already use" — that was wrong.
`node-backend`'s local Doppler scope is pinned to `dev_nk`, not `test`; every Mongo-touching
Vitest test that passed all prior session ran through `dev_nk`. The `test` config is a
genuinely separate environment (`test_user`/`postair_test`) whose Atlas credentials fail
auth outright — an infra gap, not fixed here. `dev_nk` was confirmed working and used
instead (user's explicit choice after this was surfaced). This means the seeded account
and later E2E runs live in the **real shared dev database** (`postairs`), not an isolated
test DB — see updated Risks section.
Mirrors the upsert pattern already proven in `post-crud.integration.test.js`:
upsert-by-email, `isVerified: true`. Password hashed with `bcrypt` at **10 salt rounds**
(Python `bcrypt.hashpw(..., bcrypt.gensalt(10))`, byte-for-byte compatible with
`bcrypt.compare()` in `node-backend/auth/authUtils.js` — confirmed `loginUser()` does a
plain compare with no `isVerified` gate on login itself). Plaintext password stored only
as a Doppler `dev_nk`-config secret (`E2E_TEST_PASSWORD`) — never committed, never
hardcoded in spec files (Phase 2 reads it from `process.env`).
Done when:
- [x] Script runs cleanly, account exists in the `dev_nk` Mongo DB (`e2e-test-writer@postair.test`)
- [x] Manual `curl -X POST http://localhost:3000/auth/login` with the seeded email/password
      returns `200` with a valid `accessToken` — proves the hash actually round-trips
      through the real endpoint, not just that a document exists

### Phase 1 — Playwright project scaffold — ✅ DONE (Run 3, 2026-08-06)
Goal: a working, empty Playwright workspace pointed at a configurable `BASE_URL`.
Files: `e2e/package.json`, `e2e/playwright.config.ts`, `e2e/.env.example`
Done when: `npx playwright test --list` runs cleanly with zero spec files; `BASE_URL`
defaults to local dev (`http://localhost:4200`), overridable via env var.
Note: `@playwright/test` pinned to `^1.62.1` (verified latest at time of install via
`npm view`, not guessed). Chromium installed without `--with-deps` — the `--with-deps`
flag needs sudo/a terminal password prompt, unavailable in this environment; plain
`npx playwright install chromium` succeeded without it. If a fresh environment hits
missing system libs at test-run time, that's the thing to revisit.

### Phase 2 — Auth + smoke spec
Goal: first real spec — log in with the seeded account, confirm an authenticated route
(`/dashboard/myactivity`) loads without redirecting to `/login`.
Files: `e2e/tests/auth.spec.ts`
Done when: `npx playwright test auth.spec.ts` passes headlessly.

### Phase 3 — Reader view specs
Goal: home feed loads with posts, keyword search returns results, post detail and
quick-view both open correctly from a feed card.
Files: `e2e/tests/reader.spec.ts`
Done when: passes headlessly against a seeded/existing post (may need at least one
published post to exist — check against Phase 0's account or an already-seeded post).

### Phase 4 — Writer console specs
Goal: authenticated create-draft → edit → publish → delete cycle; tag autocomplete.
Media upload excluded per Missing Context #2 unless redirected.
Files: `e2e/tests/writer-console.spec.ts`
Done when: full CRUD cycle passes headlessly, cleans up any posts it creates
(mirrors the `createdUuids` cleanup pattern from `post-crud.integration.test.js`).

### Phase 5 — Writer dashboard/profile specs
Goal: profile loads live stats/drafts/favorites from `/profile/me/full-profile`;
`CONTRIBUTION_ACTIVITY`/`RECENT_ACTIVITY` sections confirmed **absent** by default
(both `enabled_prod: false` — this is a negative assertion, not a skip).
Files: `e2e/tests/writer-profile.spec.ts`
Done when: passes headlessly, including the negative flag-off assertions.

### Phase 6 — Final: full pure-CLI run + report
Goal: run the entire authored suite in one headless pass, no LLM involved in execution
at any point, produce Playwright's HTML report as the real signal to decide next steps
from — this phase does not require 100% green, it requires a complete, trustworthy run.
Files: none new — `npx playwright test` (full suite) from `e2e/`
Done when: full suite completes and produces a report; results (not this plan) determine
what happens next.

## Risks

- **Password hash mismatch** (Phase 0) would silently break every later phase's login —
  the manual curl check in Phase 0's done-when exists specifically to catch this before
  building anything on top of it.
- **Real shared dev database** (`dev_nk` → `postairs`, not an isolated test DB — see Phase 0
  correction above): seeded account is namespaced (`e2e-test-writer@postair.test`, distinct
  from Vitest's `int-test-writer@postair.test`) to avoid collision, but later phases that
  create posts/media (Phase 4) must clean up after themselves — anything left behind is
  visible in the same dev environment a human might be using.
- **Local three-service orchestration** (if Missing Context #1 stays defaulted to local):
  `local.entry.sh`'s Redis bootstrap is already known to fail in at least one environment
  this session — Phase 1 should surface that early rather than let it silently block later
  phases that depend on queue-driven side effects (analytics events, OTP mail — though the
  latter is out of scope per Missing Context #3).
- **Flaky reader-view specs** if no post exists yet in the target DB — Phase 3 may need to
  seed a minimal published post alongside Phase 0's account, or depend on Phase 4 running
  first to create one. Decide when Phase 3 starts, not now.
