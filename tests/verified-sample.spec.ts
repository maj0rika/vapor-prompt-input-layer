import { expect, test } from '@playwright/test';

test.describe('verified sample run', () => {
  test('loads a deterministic sample without DeepSeek and gates approval on real validation', async ({
    page,
  }) => {
    let chatCalls = 0;
    let validationCalls = 0;

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/deepseek/chat')) chatCalls += 1;
      if (url.includes('/api/deepseek/validate')) validationCalls += 1;
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Run verified sample' }).click();

    await expect(page.getByLabel('Verified sample provenance')).toBeVisible();
    await expect(page.getByText('Deterministic fixture')).toBeVisible();
    await expect(page.getByText('No DeepSeek call')).toBeVisible();
    await expect(page.getByText('Same parser')).toBeVisible();
    await expect(page.getByText('Same Canvas runtime')).toBeVisible();
    await expect(page.getByText('Same validation runner')).toBeVisible();
    await expect(page.locator('[aria-label="Validation: waiting"]')).toBeVisible();
    await expect(page.getByText('Validation: waiting for runner output')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve current artifact' })).toBeDisabled();
    expect(chatCalls).toBe(0);
    expect(validationCalls).toBe(0);

    await expect(page.getByRole('tab', { name: 'Canvas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('tab', { name: 'Component' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Story' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Test', exact: true })).toBeVisible();
    await expect(
      page
        .frameLocator('iframe[title="Generated artifact canvas"]')
        .getByRole('button', { name: 'Deploy component' }),
    ).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Metadata contract: PASS')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disabled variant' })).toBeVisible();

    await page.getByRole('button', { name: 'Run validation' }).click();
    await expect(page.locator('[aria-label="Validation: active"]')).toBeVisible();
    await expect.poll(() => validationCalls).toBeGreaterThan(0);

    await expect(page.locator('[aria-label="Validation: pass"]')).toBeVisible({
      timeout: 20000,
    });
    await page.getByRole('tab', { name: 'Tests' }).click();
    await expect(
      page.getByRole('listitem').filter({ hasText: /^Typecheck: PASS$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('listitem').filter({ hasText: /^Runtime Render: PASS$/ }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: /Runtime Render: PASS.*2 metadata variants \(Default, Disabled\)/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('listitem').filter({ hasText: /^Cleanup: PASS$/ }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve current artifact' })).toBeEnabled();
    expect(chatCalls).toBe(0);
  });
});
