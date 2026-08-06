---
status: done
phase: 6-of-6
assigned: claude-code
generated: 2026-08-06
---

# Execution brief — E2E Platform Validation

## Session bootstrap
Read in this order before any action:
1. CLAUDE.md (repo root)
2. node-backend/CLAUDE.md, ng-frontend/CLAUDE.md
3. .agent/tasks/e2e-platform-validation.plan.md (full plan — phase details, risks, missing context)
4. docs/testing/e2e-scope-mapping.md (what's in scope and why, ranked by risk)
5. docs/research/2026-08-06-llm-agent-e2e-testing.md (why this is pure-CLI, not agent-executed)

## Current phase: Phase 2 — Auth + smoke spec
Goal: first real spec — log in with the seeded account (`e2e-test-writer@postair.test`,
password from Doppler `dev_nk` config's `E2E_TEST_PASSWORD`), confirm an authenticated
route (`/dashboard/myactivity`) loads without redirecting to `/login`.
Copy full detail from plan.md's "Phase 2" section before starting.

## Exact file list for this session
CREATE  e2e/tests/auth.spec.ts

## Must not change this session
- Any production route/model/service file
- node-backend/tests/* (Vitest suite)
- e2e/playwright.config.ts, e2e/package.json (Phase 1 — done, don't touch unless the
  spec genuinely needs a config change; note it in the Log if so)

## Build check
`cd e2e && doppler run --project postair --config dev_nk -- npx playwright test auth.spec.ts`
— must pass headlessly.

## Done when
- [ ] `auth.spec.ts` passes headlessly against the local dev stack
- [ ] Test reads `E2E_TEST_PASSWORD` from `process.env`, never hardcodes it
- [ ] Asserts on something meaningful post-login (URL is `/dashboard/myactivity`, not
      redirected to `/login`; or a known authenticated-only element is visible) —
      not just "no error thrown"

## On completion
Update this file:
  phase: 2-of-6 → 3-of-6
  status: pending → in_progress (or back to pending if handing off)
  Append to Log:
  ### Run N — YYYY-MM-DD
  Output: [what was built]
  Gap:    [anything unfinished or deviated]
  Action: [what the next session needs to know]

## Hard stops
- Do not begin Phase 3 in this session even if Phase 2 finishes early — verify, log, stop
- Do not resolve Missing Context #2/#3 from plan.md by guessing — ask, or use the stated
  defaults (media upload excluded; signup/OTP excluded) and note in the Log which default
  was taken
- If login fails, check whether it's a real app bug vs. an env/credential issue (compare
  against the Phase 0 curl check, which is known-good) before concluding either way

## Log
<!-- Append after each run. Never delete old entries. -->

### Run 1 — 2026-08-06
Output: Wrote `data-utils/seed_e2e_account.py` — deviated from the plan's assumed
`.js` file since this directory's actual established convention is Python
(`bcrypt` already pinned in `requirements.txt`, every existing seed/backfill script is
Python + pymongo, same `MONGO_URI`-from-env pattern as `backfill_published.py`). Set
`E2E_TEST_PASSWORD` as a new Doppler `test`-config secret (24-char random, not
committed). Ran the script via `doppler run --config test -- python3 seed_e2e_account.py`.
Gap: **Plan's assumption was wrong** — the plan said this should use "the same `test`
Doppler config the existing Vitest integration tests already use." Checked
`node-backend`'s local Doppler scope (`doppler configure`): it's pinned to **`dev_nk`**,
not `test`. Every Mongo-touching Vitest test that passed this whole prior session ran
through `dev_nk` by default (no test in this repo has ever actually exercised the `test`
config's DB connectivity). Confirmed `test` and `dev_nk` are genuinely different
environments (`test_user`/`postair_test` vs. `postair-app`/`postairs`), not an
accidental duplicate — and `test`'s Mongo credentials fail Atlas auth
(`bad auth : Authentication failed`, `AtlasError` code 8000). This is an infra/credentials
gap on the `test` config itself, not a script bug.
Action: **Blocked — needs a decision, not a guess.** Two options: (a) fix/rotate the
`test` config's Atlas credentials (needs Atlas dashboard access this session doesn't
have), or (b) point Phase 0 (and later phases) at `dev_nk` instead, which is proven
working — but that's a real shared dev database (`postairs`), not an isolated test DB,
so seeding/E2E-running against it has different blast-radius implications than the
plan assumed. Do not resume Phase 0 by silently picking one — get the call first.

### Run 2 — 2026-08-06 (unblocked)
Output: User chose option (b) — `dev_nk`. Set a fresh `E2E_TEST_PASSWORD` secret on the
`dev_nk` config (separate from the one left on `test`, which is now unused/orphaned —
harmless to leave, or delete later if `test` config is ever decommissioned). Re-ran
`doppler run --project postair --config dev_nk -- python3 seed_e2e_account.py` —
succeeded, created `e2e-test-writer@postair.test` (`_id=6a740821e2b88db80f1e2afa`).
Verified via the actual running dev server (`http://localhost:3000`, confirmed healthy —
`/health` showed Mongo + Python search both connected): `curl -X POST
http://localhost:3000/auth/login` with the seeded credentials returned `200` with a real
`accessToken` and correct user profile. Bcrypt hash round-trip confirmed working.
Gap: None — Phase 0 fully done. Plan.md updated in place to correct the `test`→`dev_nk`
assumption and the `.js`→`.py` file choice, so future sessions reading it don't repeat
the same investigation.
Action: Phase 0 complete. `data-utils/seed_e2e_account.py` is idempotent (safe to re-run
if the account needs recreating). Next: Phase 1 (Playwright scaffold) — target
environment is the local dev stack, `node-backend` already confirmed running.

### Run 3 — 2026-08-06
Output: Confirmed `ng-frontend` dev server live (`localhost:4200` → 200) alongside the
already-running `node-backend` (`localhost:3000/health` → 200, Mongo + Python both
connected). Scaffolded `e2e/` as its own top-level Playwright workspace: `package.json`
(`@playwright/test ^1.62.1`, verified via `npm view`, not guessed), `playwright.config.ts`
(`BASE_URL` defaults to `http://localhost:4200`, HTML+list reporters, trace/screenshot/video
on failure only), `.env.example`. `npm install` + `npx playwright install chromium`
succeeded (had to drop `--with-deps`, which needs a sudo password prompt unavailable
here — plain chromium install worked fine). `npx playwright test --list` → "No tests
found," exit 1 — expected/correct for zero spec files, not a config error. Added
`e2e/playwright-report/` and `e2e/test-results/` to root `.gitignore` (used `git add -p`
to stage only that hunk, since the file already had an unrelated pending change from
earlier in the session that's still intentionally deferred).
Gap: None against this phase's scope.
Action: Phase 1 complete. Committed as `174fafc` on `chore/e2e-platform-validation`
(branched off `preview`, which is protected here — nothing committed directly to it).
Next: Phase 2 — first real spec, `e2e/tests/auth.spec.ts`, log in with the seeded account
and assert `/dashboard/myactivity` loads.

### Run 4 — 2026-08-06 (blocked — real app bug found)
Output: Wrote `e2e/tests/auth.spec.ts` (real behavior confirmed by reading source first:
successful login navigates to `/home`, not `/dashboard` — `AuthShell.executeLogin()` is
dead code, `console.log` only; real login lives entirely in the `Login` component). First
run failed: Sign In button stayed disabled after filling both fields. Diagnosed rather
than guessed — added a throwaway debug spec (deleted after use, never committed): captured
browser console via `page.on('console'/'pageerror')`. Root cause: `Login.ngOnInit()` calls
`AuthService.initGoogle()`, which does `(window as any).google.accounts.id.initialize(...)`
with **no optional chaining** (`node-backend`... no — `ng-frontend/src/app/core/services/
auth-service.ts:91`, and `renderButton()` at `:120` has the same pattern). `window.google`
is `undefined` until the async `<script src="https://accounts.google.com/gsi/client"
async>` tag (`index.html`) finishes loading — a real race, not a sandbox-only artifact;
a different method in the same file (`:84`) already guards the identical access with
`?.`, so this is an inconsistency, not a deliberate design choice. The uncaught
`TypeError` thrown mid-`ngOnInit` leaves the component's change detection for that view
in a broken state — reactive form control DOM sync stops working correctly afterward,
which is why `.fill()`/`.type()` on the email field wouldn't stick (password field, bound
identically, was unaffected only because it happened to be filled in the same tick before
things fully broke — inconsistent/flaky, not reliably "safe").
Gap: This blocks Phase 2 entirely — the login form is unusable while this bug is present,
in the browser, not just in the test. Per this session's "Must not change: any production
route/model/service file" constraint, did not patch `auth-service.ts` — that's a real
production fix, out of this test-only phase's stated scope, needs a call.
Action: **Blocked — needs a decision.** Options: (a) fix `auth-service.ts:91`/`:120` with
optional chaining (small, low-risk, matches the existing pattern at `:84` exactly) so both
the app and this test work correctly, (b) work around it test-side only (e.g. block/stub
requests to `accounts.google.com` so the script never loads and the race never triggers) —
masks the bug rather than fixing it, and the E2E suite's whole point is to surface exactly
this kind of thing, or (c) something else. Do not resume by silently picking one.

### Run 5 — 2026-08-06 (unblocked, Phase 2 complete)
Output: User chose option (b), test-side workaround. Added `e2e/tests/helpers.ts` —
`stubGoogleIdentity(page)` blocks `accounts.google.com` network requests and injects a
fake `window.google.accounts.id` (no-op `initialize`/`renderButton`/`disableAutoSelect`/
`prompt`) via `page.addInitScript()` before any app script runs, so `Login.ngOnInit()`
never hits the unguarded property access. Also added `login(page, email, password)`
helper (stub → goto /login → fill → submit → wait for `/home`) for reuse by later phases
that need an authenticated session (Phase 4, 5). Rewrote `auth.spec.ts` to use both.
Mid-run, `ng-frontend`'s dev server went down (`ERR_CONNECTION_REFUSED` on
`localhost:4200`) — not an app or test bug, ng serve had stopped; confirmed via curl
before reporting, user restarted it, confirmed back up (curl 200), re-ran.
Final run: both tests pass — real login through the real endpoint, session persists
through an auth-guarded route, and the negative case (unauthenticated → redirected to
`/login`) also passes.
Gap: None against this phase's scope. The underlying `auth-service.ts` bug from Run 4
is still unfixed in production code, by explicit choice — remains open, tracked here,
not silently dropped.
Action: Phase 2 complete. Files to commit: `e2e/tests/auth.spec.ts`, `e2e/tests/helpers.ts`,
plus `.gitignore` (already had `e2e/test-results/`/`e2e/playwright-report/` entries sitting
uncommitted from earlier in the session — folded into this commit since they're now
directly relevant, not just a deferred stray). Next: Phase 3 — reader view specs
(`e2e/tests/reader.spec.ts`) — home feed, keyword search, post detail, quick view. May
need at least one published post to exist in the `dev_nk` DB; check before assuming one
does.

### Run 6 — 2026-08-06 (Phase 3 complete)
Output: Confirmed via `curl /api/feed` that `dev_nk`'s DB already has multiple real
published posts (e.g. "AI infrastructure at scale", "LLM cost management",
"APM with sentry") — no seeding needed for this phase. Read `home.html`/`home.ts`,
`search-bar.html`, `post-detail.html`, and the quick-view component templates before
writing selectors (same discipline as Phase 2, not guessed): cards are
`.bento-item[data-post-id]`, click → `openDetails()` → `/home/view/:slugOrUuid`; the
quick-view trigger is `button[title="Quick view"]` → `/home/quick-view/:uuid`; search
input is `.search-input-main`, submits on Enter; post-detail title is `h1.canvas-title`,
quick-view title is `h2.content-title`. Wrote `e2e/tests/reader.spec.ts` — 4 tests: home
feed loads, keyword search ("Sentry" → matches the real seeded "APM with sentry" post),
post detail opens with matching title, quick view opens with matching title. All 4
passed on the first real run — no selector debugging needed this time, unlike Phase 2.
Gap: None.
Action: Phase 3 complete, committed. Next: Phase 4 — writer console specs
(`e2e/tests/writer-console.spec.ts`) — authenticated create-draft → edit → publish →
delete cycle, tag autocomplete. Media upload still excluded per plan.md's Missing
Context #2 unless redirected. Uses the `login()` helper from Phase 2. Must clean up any
posts it creates (mirror `post-crud.integration.test.js`'s `createdUuids` pattern) —
this runs against the real shared `dev_nk` dev DB, not an isolated test DB.

### Run 7 — 2026-08-06 (Phase 4 complete)
Output: Read `post-form.html`, `post-list.html`, `post-edit.html` before writing
selectors (same discipline as Phases 2–3). Wrote
`e2e/tests/writer-console.spec.ts` — full cycle: expand New Post → fill title +
180-char description (server `minlength: 120` isn't enforced client-side, so anything
shorter would 400 — noted, not fixed) → tag autocomplete (selects the real "ai" tag
from the suggestion dropdown) → Save Draft (captures the created `uuid` via
`page.waitForResponse` on the real POST) → confirm draft badge → Edit → Publish →
confirm published badge → Delete → confirm removal. Cleanup is real: the test's own
last step deletes via the UI (what's actually being verified), plus an `afterEach`
safety net that force-deletes via a direct API call using the token captured right
after login, in case an earlier assertion throws first.
Two real findings along the way, both about defaults I'd assumed wrong from reading
the template's `@if` conditionals rather than the actual runtime signal values:
1. The "New post" panel is expanded by default (not collapsed as `@if (!showNewForm())`
   suggested) — fixed by waiting properly for the title input instead of an instant,
   non-waiting `.isVisible()` check (which fired before Angular's first render completed
   and always returned false, causing a 30s timeout hunting for a "+" button that would
   never appear).
2. `onCloseEdit()` (writer-console.ts:72-78) deliberately collapses "My posts" and
   re-expands "New post" whenever the edit panel closes — including automatically after
   a successful publish/save. Not a bug, but means the row leaves the DOM entirely after
   publishing, not just its badge text — the test re-expands "My posts" (as a real user
   would) before asserting the new status.
Also fixed a naming inconsistency: used `API_BASE_URL` initially, but Phase 1's
`.env.example` already established `NODE_API_URL` for this — renamed to match rather
than introduce a duplicate env var.
All test runs used the real `dev_nk` DB; confirmed no leftover posts (the created draft
was deleted via UI before the test ended, `afterEach` had nothing to do).
Gap: None against this phase's scope.
Action: Phase 4 complete, committed. Next: Phase 5 — writer dashboard/profile specs
(`e2e/tests/writer-profile.spec.ts`) — `/profile/me/full-profile` loads live
stats/drafts/favorites; `CONTRIBUTION_ACTIVITY`/`RECENT_ACTIVITY` sections confirmed
**absent** by default (negative assertion, both `enabled_prod: false`). Uses the same
`login()` helper.

### Run 8 — 2026-08-06 (Phase 5 complete)
Output: Confirmed via `writer-profile.html` that both `CONTRIBUTION_ACTIVITY` and
`RECENT_ACTIVITY` are `false` in `ng-frontend`'s `environment.ts` (dev), not just
`environment-prod.ts` — the negative assertion holds in this local-dev-stack run, not
only in prod. Wrote `e2e/tests/writer-profile.spec.ts` — 2 tests: (1) profile loads via
a single real `GET /profile/me/full-profile` call (captured via
`page.waitForResponse`), real seeded name renders, 4 stat cards present, drafts/favorites
sections finish loading (no assertion on exact counts — kept independent of other spec
files' execution order/state); (2) `.contribution-section` and "Recent Activity" heading
text both assert `toHaveCount(0)` — proving the `@if` genuinely excludes the DOM nodes,
not just CSS-hides them.
One trivial fix: first run asserted stat label text as `['Posts', 'Reach', ...]` and
failed — `.stat-label` has `text-transform: uppercase` in CSS, so `innerText()` (which
reflects rendered casing) returned `['POSTS', 'REACH', ...]`. My test's own casing bug,
not an app issue — fixed the expectation.
Gap: None.
Action: Phase 5 complete, committed. **Only Phase 6 remains** — the final full pure-CLI
suite run (`npx playwright test`, no LLM anywhere in execution) across all 4 spec files,
producing the HTML report as the real signal to decide next steps from. Nothing else to
resolve first.

### Run 9 — 2026-08-06 (Phase 6 complete — plan fully executed)
Output: `doppler run --project postair --config dev_nk -- npx playwright test` (full
suite, all 4 spec files, single worker, headless Chromium) — **9/9 tests passed in
~16.4s.** Zero LLM anywhere in the execution path — pure CLI, exactly as scoped from the
start. HTML report generated at `e2e/playwright-report/index.html`
(`npx playwright show-report` to view). No cleanup needed — writer-console.spec.ts's own
test deletes what it creates, everything else is read-only against the app.
Real findings produced by this pass, not busywork — this is the actual signal the plan
exists to generate:
1. **Production bug, still unfixed by explicit choice**: `auth-service.ts:91`/`:120` —
   unguarded `window.google.accounts.id` access crashes `Login.ngOnInit()` whenever
   Google's async script hasn't loaded yet, corrupting the login form's reactive
   bindings. Affects real users (slow connections, ad-blockers, blocked
   `accounts.google.com`), not just this environment. Test-side workaround
   (`stubGoogleIdentity()` in helpers.ts) lets the suite run; the app itself is
   unpatched. User said this is real and will be addressed in a separate session.
2. Two UI-behavior discoveries during Phase 4 that turned out to be intentional, not
   bugs, once traced to source: the "New post" panel defaults expanded (not collapsed
   as the template's `@if` suggested), and `onCloseEdit()` deliberately collapses "My
   posts"/re-expands "New post" on every successful publish/save — both now documented
   in the spec's own comments for whoever reads it next.
3. Confirmed (not just assumed) that `CONTRIBUTION_ACTIVITY`/`RECENT_ACTIVITY` are
   genuinely excluded from the DOM in this environment's actual `environment.ts`, not
   only in `environment-prod.ts`.
Gap: None — plan fully executed, Step 0 (test account) through Step Final (pure-CLI run)
complete.
Action: **Task complete.** Handing back to the user with the 9/9 result and the one open
production bug (Google Identity crash) to decide next steps from, per the plan's own
framing ("then we will decide from result") — this exec file does not make that call.
