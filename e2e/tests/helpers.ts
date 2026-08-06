import { Page } from '@playwright/test';

/**
 * Stubs window.google before any app script runs, so Login.ngOnInit()'s unguarded
 * `window.google.accounts.id.initialize(...)` call (auth-service.ts:91, and
 * renderButton() at :120 — same pattern) doesn't throw and corrupt that view's
 * change detection for the rest of the component's life.
 *
 * Test-side workaround only, by explicit choice — the underlying app bug (missing
 * optional chaining, inconsistent with the already-guarded pattern at
 * auth-service.ts:84) is NOT fixed here. Full root-cause writeup:
 * .agent/tasks/e2e-platform-validation.exec.md, Run 4.
 */
export async function stubGoogleIdentity(page: Page) {
  await page.route('https://accounts.google.com/**', (route) => route.abort());
  await page.addInitScript(() => {
    (window as any).google = {
      accounts: {
        id: {
          initialize: () => {},
          renderButton: () => {},
          disableAutoSelect: () => {},
          prompt: () => {},
        },
      },
    };
  });
}

export async function login(page: Page, email: string, password: string) {
  await stubGoogleIdentity(page);
  await page.goto('/login');
  await page.getByPlaceholder('name@company.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/home$/, { timeout: 10_000 });
}
