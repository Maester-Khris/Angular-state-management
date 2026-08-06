import { test, expect } from '@playwright/test';
import { login } from './helpers';

/**
 * Writer dashboard/profile specs — /profile/me/full-profile loads live
 * profile/stats/drafts/favorites in a single call, and the still-flagged-off
 * Sprint 08b sections (CONTRIBUTION_ACTIVITY, RECENT_ACTIVITY — both
 * `enabled_prod: false` in feature-flags.json, and `false` in ng-frontend's
 * environment.ts too, not just environment-prod.ts) stay genuinely absent, not
 * just visually hidden.
 *
 * Selectors verified against real markup (writer-profile.html), not guessed:
 * - Profile name: `h3` inside `.profile-card`
 * - Stats: `.stats-mini-grid .stat-mini-card` (4 cards: Posts/Reach/Co-Auth/Since)
 * - Drafts: `.drafts-lab`, empty-state text "No drafts yet — start writing from your console"
 * - Favorites: `.favorites-grid`, empty-state text "No saved insights yet"
 * - Contribution heatmap (flagged off): `.contribution-section` — unique class,
 *   simplest possible negative assertion
 * - Recent Activity (flagged off): no dedicated class, asserted via absent heading text
 *
 * Doesn't assume a specific drafts/favorites count — writer-console.spec.ts's own
 * cleanup means it should be empty by the time this runs, but asserting on exact
 * counts would make this spec depend on execution order of other spec files. Instead
 * asserts the sections actually finished loading (skeleton gone), whichever state
 * they're in.
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

test('profile loads live data from a single /profile/me/full-profile call', async ({ page }) => {
  await login(page, email, password!);

  const profileResponse = page.waitForResponse(
    (res) => res.url().includes('/profile/me/full-profile') && res.request().method() === 'GET'
  );
  await page.goto('/dashboard/profile');
  await profileResponse;

  // Profile card — real seeded name, not a mock/placeholder.
  await expect(page.locator('.profile-card h3')).toHaveText('E2E Test Writer', { timeout: 10_000 });

  // Stats block — 4 cards, real structure, not asserting exact values (depends on
  // how many posts this account happens to have at run time).
  await expect(page.locator('.stats-mini-grid .stat-mini-card')).toHaveCount(4);
  // .stat-label has text-transform: uppercase in CSS — innerText reflects the
  // rendered casing, not the DOM text content.
  const statLabels = await page.locator('.stats-mini-grid .stat-label').allInnerTexts();
  expect(statLabels).toEqual(['POSTS', 'REACH', 'CO-AUTH', 'SINCE']);

  // Drafts / favorites sections finished loading (skeleton gone) — either real
  // content or the empty-state message, not stuck mid-load.
  await expect(page.locator('.drafts-lab.skeleton-loading')).toHaveCount(0);
  await expect(page.locator('.sidebar-section.skeleton-loading')).toHaveCount(0);
});

test('CONTRIBUTION_ACTIVITY and RECENT_ACTIVITY stay absent by default (not just hidden)', async ({
  page,
}) => {
  await login(page, email, password!);
  await page.goto('/dashboard/profile');
  await expect(page.locator('.profile-card h3')).toBeVisible({ timeout: 10_000 });

  // Both flags are false in ng-frontend's environment.ts (dev) and
  // environment-prod.ts alike, and enabled_prod: false in feature-flags.json —
  // this is a negative assertion on the real DOM (element count, not visibility),
  // proving the @if actually excludes the section rather than just CSS-hiding it.
  await expect(page.locator('.contribution-section')).toHaveCount(0);
  await expect(page.getByText('Recent Activity', { exact: true })).toHaveCount(0);
});
