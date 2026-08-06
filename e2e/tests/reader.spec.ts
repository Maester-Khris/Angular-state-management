import { test, expect } from '@playwright/test';
import { stubGoogleIdentity } from './helpers';

/**
 * Reader view specs — anonymous visitor: home feed, keyword search, post detail,
 * quick view. No auth needed for any of these routes.
 *
 * Selectors verified against real markup, not guessed:
 * - home.html: each card is `.bento-item[data-post-id]`, click → openDetails() →
 *   navigates to /home/view/:slugOrUuid (slug preferred over uuid when the post has one)
 * - post-card.html: quick-view trigger is `button[title="Quick view"]`
 * - search-bar.html: input is `.search-input-main`, submits on Enter (keyup.enter)
 * - post-detail.html: title is `h1.canvas-title`
 * - quick-view-content.component.html: title is `h2.content-title`
 *
 * Every test still stubs Google Identity (see helpers.ts / exec.md Run 4) — the shell
 * mounts globally, not just on /login, so the same unguarded window.google access is a
 * risk on any route until the app bug itself is fixed.
 */

test.beforeEach(async ({ page }) => {
  await stubGoogleIdentity(page);
});

test('home feed loads with real posts', async ({ page }) => {
  await page.goto('/home');
  await expect(page.locator('.bento-item').first()).toBeVisible({ timeout: 10_000 });
  const count = await page.locator('.bento-item').count();
  expect(count).toBeGreaterThan(0);
});

test('keyword search returns matching results', async ({ page }) => {
  await page.goto('/home');
  await expect(page.locator('.bento-item').first()).toBeVisible({ timeout: 10_000 });

  const search = page.locator('.search-input-main');
  await search.fill('Sentry');
  await search.press('Enter');

  // Known seeded post: "APM with sentry" (data-utils seed content, not this suite's data).
  await expect(page.locator('.bento-item', { hasText: 'APM with sentry' })).toBeVisible({
    timeout: 10_000,
  });
});

test('opening a post from the feed shows post detail', async ({ page }) => {
  await page.goto('/home');
  const firstCard = page.locator('.bento-item').first();
  await expect(firstCard).toBeVisible({ timeout: 10_000 });
  const title = await firstCard.locator('.post-title').innerText();

  await firstCard.click();

  await expect(page).toHaveURL(/\/home\/view\/.+/);
  await expect(page.locator('h1.canvas-title')).toHaveText(title);
});

test('quick view opens without leaving the feed context', async ({ page }) => {
  await page.goto('/home');
  const firstCard = page.locator('.bento-item').first();
  await expect(firstCard).toBeVisible({ timeout: 10_000 });
  const title = await firstCard.locator('.post-title').innerText();

  await firstCard.getByTitle('Quick view').click();

  await expect(page).toHaveURL(/\/home\/quick-view\/.+/);
  await expect(page.locator('h2.content-title')).toHaveText(title);
});
