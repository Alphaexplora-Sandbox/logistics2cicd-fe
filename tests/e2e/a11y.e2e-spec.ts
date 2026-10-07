import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { PAGES } from './support';

// Only the two worst impact levels fail the check. Minor and moderate
// findings are real but would turn a first run red on almost any app.
const BLOCKING_IMPACTS = ['critical', 'serious'];

for (const path of PAGES) {
  test('no critical or serious accessibility violations on ' + path, async ({
    page,
  }) => {
    await page.goto(path);

    // @axe-core/playwright peers on any playwright-core, so npm can install a
    // newer copy than @playwright/test brings and the two Page types stop
    // matching under tsc. At runtime it is the same page object.
    const axePage = page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"];
    const results = await new AxeBuilder({ page: axePage }).analyze();
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact != null && BLOCKING_IMPACTS.includes(violation.impact),
    );

    const report = blocking.map((violation) => {
      const targets = violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(' '))
        .join(', ');
      return (
        violation.id + ' (' + String(violation.impact) + '): ' +
        violation.help + ' - ' + targets
      );
    });

    expect(
      report,
      'Accessibility violations on ' + path + ':\n' + report.join('\n'),
    ).toEqual([]);
  });
}
