import { expect, test } from '@playwright/test';

// Feature 1 (Cold-Chain Consignment Intake) and the tab bar, driven the way a
// person uses them: type into the form, press the buttons, read the page.

function registeredCount(text: string | null): number {
  const match = /Registered Consignments \((\d+)\)/.exec(text ?? '');
  return match ? Number(match[1]) : -1;
}

test.describe('Feature 1: consignment intake', () => {
  test('registering a consignment adds it to the list', async ({ page }) => {
    test.info().annotations.push({
      type: 'description',
      description:
        'Fills the intake form with a valid consignment, presses Register, and expects a success message plus a new row with status Awaiting_Assignment.',
    });
    const description = `E2E vaccine pack ${Date.now()}`;

    await page.goto('/');
    const heading = page.getByText(/Registered Consignments \(\d+\)/);
    const before = registeredCount(await heading.textContent());

    await test.step('Fill the intake form', async () => {
      await page.getByTestId('input-description').fill(description);
      await page.getByTestId('input-min-temp').fill('2');
      await page.getByTestId('input-max-temp').fill('8');
      await page.getByTestId('input-weight').fill('12');
      await page.getByTestId('select-urgency').selectOption('Life-Critical');
      await page.getByTestId('input-recipient-phone').fill('+1-555-0100');
      await page.getByTestId('input-recipient-email').fill('e2e@example.org');
    });

    await test.step('Press Register', () => page.getByTestId('btn-submit-intake').click());

    await test.step('Check the success message', async () => {
      await expect(page.getByTestId('intake-success')).toBeVisible();
    });

    await test.step('Check the new row', async () => {
      await expect(heading).toHaveText(`Registered Consignments (${before + 1})`);
      const row = page.getByRole('row').filter({ hasText: description });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText('Awaiting_Assignment');
    });
  });

  test('a minimum temperature above the maximum is rejected', async ({ page }) => {
    test.info().annotations.push({
      type: 'description',
      description:
        'Enters a minimum temperature higher than the maximum, presses Register, and expects an error message instead of a new row.',
    });

    await page.goto('/');
    await page.getByTestId('input-description').fill('E2E invalid range');
    await page.getByTestId('input-min-temp').fill('10');
    await page.getByTestId('input-max-temp').fill('2');
    await page.getByTestId('btn-submit-intake').click();

    await expect(page.getByTestId('intake-error')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'E2E invalid range' })).toHaveCount(0);
  });
});

test.describe('Tab bar', () => {
  for (const [tab, section] of [
    ['tab-dispatch', 'section-dispatch'],
    ['tab-telemetry', 'section-telemetry'],
    ['tab-delivery', 'section-delivery'],
  ] as const) {
    test(`${tab} opens ${section}`, async ({ page }) => {
      test.info().annotations.push({
        type: 'description',
        description: `Presses the ${tab} button and expects ${section} to show.`,
      });
      await page.goto('/');
      await page.getByTestId(tab).click();
      await expect(page.getByTestId(section)).toBeVisible();
    });
  }
});
