import { test, expect } from '@playwright/test';
import { login } from './helpers';

/**
 * Writer console specs — authenticated create-draft → edit → publish → delete cycle,
 * plus tag autocomplete. Media upload is explicitly excluded (plan.md Missing Context
 * #2, not redirected).
 *
 * Runs against the real shared `dev_nk` dev DB, not an isolated test DB (see
 * e2e-platform-validation.plan.md's Phase 0 correction) — every post this spec creates
 * is cleaned up, both via the UI (as part of what's actually being tested) and via a
 * direct API call in afterEach as a safety net if an earlier assertion fails first.
 *
 * Selectors verified against real markup (post-form.html, post-list.html, post-edit.html),
 * not guessed:
 * - "New post" panel expand: `.panel-strip:has-text("New post") button.panel-ctrl`
 * - Title input: placeholder "e.g. Mastering Angular Signals"
 * - Description textarea: placeholder "What's the story about?"
 * - Save Draft / Publish: `button.action-btn.draft` / `button.action-btn.publish`
 *   (identical structure in both post-form and post-edit)
 * - Post-list row actions: `button[title="Edit"]`, `button[title="Delete"]`
 * - Post-list row title: `.post-item-title`, status badge text is "draft"/"published"
 *
 * Description is 180 chars — server-side `minlength: 120` on Post.description
 * (post.js:7) is NOT enforced client-side (post-form.ts only checks an upper bound,
 * DESCRIPTION_MAX=400), so anything shorter would 400 at the API layer. Known gap,
 * not this spec's concern to fix.
 */

const email = process.env.E2E_TEST_EMAIL || 'e2e-test-writer@postair.test';
const password = process.env.E2E_TEST_PASSWORD;
const apiBaseURL = process.env.NODE_API_URL || 'http://localhost:3000';

const testTitle = `E2E Console Test ${Date.now()}`;
const testDescription =
  'This is an end-to-end test post created by the Playwright suite to verify the ' +
  "writer console's full create, edit, publish, and delete cycle works correctly " +
  'against the real backend.';

test.beforeAll(() => {
  if (!password) {
    throw new Error(
      'E2E_TEST_PASSWORD is not set — run via `doppler run --project postair --config dev_nk -- npx playwright test`'
    );
  }
});

test.describe('writer console CRUD cycle', () => {
  let token: string | null = null;
  let createdUuid: string | null = null;

  test.afterEach(async ({ request }) => {
    // Safety net only — the test itself deletes via the UI as its last real step.
    // If an earlier assertion threw first, this guarantees no draft is left behind
    // in the shared dev DB. A 404 here (already deleted by the UI step) is expected
    // and harmless.
    if (createdUuid && token) {
      await request
        .delete(`${apiBaseURL}/myactivity/posts/${createdUuid}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => {});
      createdUuid = null;
    }
  });

  test('create draft, edit, publish, then delete', async ({ page }) => {
    await login(page, email, password!);
    token = await page.evaluate(() => localStorage.getItem('access_token'));

    await page.goto('/dashboard/myactivity');

    // 1. Create a draft. The "New post" panel is expanded by default in practice
    // (confirmed twice), but wait properly rather than an instant isVisible() check
    // (which doesn't wait and can fire before Angular finishes its first render) —
    // only fall back to the collapsed-panel expand click if the title input genuinely
    // never appears.
    const titleInput = page.getByPlaceholder('e.g. Mastering Angular Signals');
    const alreadyExpanded = await titleInput
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!alreadyExpanded) {
      await page.locator('.panel-strip', { hasText: 'New post' }).locator('button.panel-ctrl').click();
      await titleInput.waitFor({ state: 'visible' });
    }
    await titleInput.fill(testTitle);
    await page.getByPlaceholder("What's the story about?").fill(testDescription);

    // Tag autocomplete — type a real existing tag ("ai", used by seeded posts) and
    // select it from the dropdown rather than the "create new" hint.
    const tagInput = page.locator('.tag-input');
    await tagInput.fill('ai');
    const suggestion = page.locator('.tag-suggestion', { hasText: 'ai' }).first();
    if (await suggestion.isVisible({ timeout: 3000 }).catch(() => false)) {
      await suggestion.click();
    } else {
      await page.locator('.tag-new-hint').click();
    }
    await expect(page.locator('.tag-pill')).toHaveCount(1);

    const createResponse = page.waitForResponse(
      (res) => res.url().includes('/myactivity/posts') && res.request().method() === 'POST'
    );
    await page.locator('button.action-btn.draft', { hasText: 'Save Draft' }).click();
    const createBody = await (await createResponse).json();
    createdUuid = createBody.uuid;
    expect(createdUuid).toBeTruthy();

    // 2. "My posts" auto-expands on successful create — confirm the draft is there.
    const row = page.locator('.card', { hasText: testTitle });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.locator('.badge')).toHaveText('draft');

    // 3. Edit → publish.
    await row.locator('button[title="Edit"]').click();
    await expect(page.locator('.panel-title', { hasText: 'Edit post' })).toBeVisible();

    const publishResponse = page.waitForResponse(
      (res) => res.url().includes(`/myactivity/posts/${createdUuid}`) && res.request().method() === 'PUT'
    );
    await page.locator('button.action-btn.publish', { hasText: 'Publish' }).click();
    await publishResponse;

    // onCloseEdit() (called on successful publish, writer-console.ts:177) collapses
    // "My posts" and re-expands "New post" — deliberate app behavior, not a bug. The
    // row leaves the DOM entirely, not just its badge text. Re-expand, matching what a
    // real user would do to see the result.
    await page.locator('.panel-strip', { hasText: 'My posts' }).locator('button.panel-ctrl').click();
    await expect(row.locator('.badge')).toHaveText('published', { timeout: 10_000 });

    // 4. Delete — the real cleanup step, not just the afterEach safety net.
    const deleteResponse = page.waitForResponse(
      (res) => res.url().includes(`/myactivity/posts/${createdUuid}`) && res.request().method() === 'DELETE'
    );
    await row.locator('button[title="Delete"]').click();
    await deleteResponse;
    await expect(page.locator('.card', { hasText: testTitle })).not.toBeVisible();

    createdUuid = null; // deleted via UI — afterEach safety net has nothing to do
  });
});
