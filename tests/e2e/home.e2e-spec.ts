import { expect, test } from '@playwright/test';

test.describe('logistics2cicd-frontend deployment', () => {
  test('serves its entry page', async ({ page }) => {
    const response = await page.goto('/');

    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });
});
