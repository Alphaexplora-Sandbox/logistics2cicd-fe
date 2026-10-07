import { expect, test } from '@playwright/test';

import { PAGES, collectPageProblems } from './support';

// Every page in PAGES must answer with a success status and load without
// logging a console error or throwing an uncaught error.
for (const path of PAGES) {
  test('loads ' + path + ' without errors', async ({ page }) => {
    const problems = collectPageProblems(page);

    const response = await page.goto(path);
    expect(response, 'No response for ' + path).not.toBeNull();
    const status = response?.status() ?? 0;
    expect(status, path + ' answered with HTTP ' + String(status)).toBeLessThan(
      400,
    );

    await page.waitForLoadState('load');

    expect(
      problems,
      path + ' logged errors:\n' + problems.join('\n'),
    ).toEqual([]);
  });
}
