import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

// The home page at a desktop and a phone size, compared with the reference
// screenshots approved in ALPHACI (downloaded into __visual__ before the run).
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

// Nothing is masked by default. Mask regions that change on every load - a
// clock, a rotating banner, a random avatar - so they do not fail the check:
// const mask = (page: Page) => [page.locator('[data-testid="live-clock"]')];
const mask = (_page: Page) => [];

/**
 * Compare with the approved reference, or record the first one.
 *
 * With no reference yet, Playwright would write the screenshot AND fail the
 * test, turning every new project red before anyone could approve anything.
 * Instead a missing reference is captured here and the test passes; ALPHACI
 * shows it as "new" for approval. A changed page still fails, with a diff.
 */
async function expectApprovedScreenshot(page: Page, file: string) {
  const reference = join(test.info().project.testDir, '__visual__', file);
  const options = { fullPage: true, animations: 'disabled' as const, mask: mask(page) };
  if (!existsSync(reference)) {
    await page.screenshot({ ...options, path: reference });
    test.info().annotations.push({
      type: 'visual',
      description: file + ': new screenshot, waiting for approval in ALPHACI',
    });
    return;
  }
  await expect(page).toHaveScreenshot(file, options);
}

for (const { name, width, height } of VIEWPORTS) {
  test.describe('home page at ' + name + ' size', () => {
    test.use({ viewport: { width, height } });

    test('matches the approved screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('load');
      await expectApprovedScreenshot(page, 'home-' + name + '.png');
    });
  });
}
