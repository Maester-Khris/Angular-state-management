import { test, expect } from '@playwright/test';
import { login, stubGoogleIdentity } from './helpers';

/**
 * Auth + smoke spec — logs in with the seeded E2E account
 * (data-utils/seed_e2e_account.py) and confirms the session actually
 * authenticates an auth-guarded route.
 *
 * Note on the app's real login flow (confirmed by reading the source, not assumed):
 * AuthShell's `executeLogin()` handler is dead code (`console.log` only) — the actual
 * login happens entirely inside the Login component, which calls
 * `authservice.login(...).subscribe(res => router.navigate(['home']))`. A successful
 * login therefore lands on `/home`, not `/dashboard`. This spec follows that real
 * behavior rather than the originally-assumed `/dashboard/myactivity` redirect.
 *
 * Every test that reaches /login uses helpers.stubGoogleIdentity() — see that file's
 * header comment and .agent/tasks/e2e-platform-validation.exec.md Run 4 for why: the
 * unguarded `window.google.accounts.id` access in auth-service.ts crashes ngOnInit and
 * corrupts the reactive form's change detection otherwise. Test-side workaround only,
 * by explicit choice — the app bug itself is not fixed here.
 */

const email = process.env.E2E_TEST_EMAIL || 'e2e-test-writer@postair.test';
const password = process.env.E2E_TEST_PASSWORD;

test.beforeAll(() => {
  if (!password) {
    throw new Error(
      'E2E_TEST_PASSWORD is not set — run via `doppler run --project postair --config dev_nk -- npx playwright test`'
    );
  }
});

test('logs in with the seeded account and reaches an auth-guarded route', async ({ page }) => {
  await login(page, email, password!);
  await expect(page).toHaveURL(/\/home$/);

  // Prove the session persists: an auth-guarded route must load, not bounce to /login.
  await page.goto('/dashboard/myactivity');
  await expect(page).toHaveURL(/\/dashboard\/myactivity$/);
  await expect(page.getByText('New post')).toBeVisible();
});

test('unauthenticated visitor is redirected away from a guarded route', async ({ page }) => {
  // Negative case — same guard, no session. Uses a fresh browser context (no storage
  // reuse) since Playwright test contexts are isolated per test by default. Still needs
  // the Google stub since the guard bounces to /login, which mounts Login/ngOnInit.
  await stubGoogleIdentity(page);
  await page.goto('/dashboard/myactivity');
  await expect(page).toHaveURL(/\/login$/);
});
