import { expect, test } from '@playwright/test';

// Links checked per run. A cap keeps the stage fast on a link-heavy page.
const MAX_LINKS = 25;

// Follows every same-origin link on the home page and fails on any that
// answers with an error. The `request` fixture is built from the same
// `use` block as the browser, so it sends the same Vercel protection-bypass
// header as every other check.
test('internal links on the home page resolve', async ({ page, request }) => {
  await page.goto('/');

  const origin = new URL(page.url()).origin;
  const hrefs = await page.locator('a[href]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('href') ?? ''),
  );

  const targets = new Set<string>();
  for (const raw of hrefs) {
    const href = raw.trim();
    if (href === '' || href.startsWith('#')) {
      continue;
    }
    if (/^(mailto|tel|javascript):/i.test(href)) {
      continue;
    }
    let url: URL;
    try {
      url = new URL(href, page.url());
    } catch {
      continue;
    }
    if (url.origin !== origin) {
      continue;
    }
    url.hash = '';
    targets.add(url.toString());
  }

  const broken: string[] = [];
  for (const link of Array.from(targets).slice(0, MAX_LINKS)) {
    try {
      const response = await request.get(link);
      if (response.status() >= 400) {
        broken.push(String(response.status()) + ' ' + link);
      }
    } catch (error) {
      broken.push('unreachable ' + link + ' (' + String(error) + ')');
    }
  }

  expect(
    broken,
    'Broken links on the home page:\n' + broken.join('\n'),
  ).toEqual([]);
});
