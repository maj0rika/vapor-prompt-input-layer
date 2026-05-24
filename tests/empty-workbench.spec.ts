import { expect, test } from '@playwright/test';

test.describe('empty workbench', () => {
  test('proves the DS automation workflow before the first prompt', async ({ page }) => {
    await page.setViewportSize({ width: 1480, height: 960 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Vapor DS Automation Workbench' })).toBeVisible();
    await expect(
      page.getByText('Generate, render, validate, repair, and approve Vapor Design System artifacts.'),
    ).toBeVisible();
    await expect(
      page.getByLabel('Prompt to Artifact to Canvas to Validation to Repair to Approve'),
    ).toBeVisible();
    await expect(page.locator('[aria-label="Validation: waiting"]')).toBeVisible();
    await expect(page.getByText('Canvas waiting')).toBeVisible();
    await expect(page.getByText('Validation gates ready')).toBeVisible();
    await expect(page.getByText('Repair loop available after failure')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run validation' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Fix with Agent' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Approve current artifact' })).toBeDisabled();
    await expect(page.locator('iframe[title="Generated artifact canvas"]')).toHaveCount(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    const bodyOverflow = await page.evaluate(
      () => document.body.scrollWidth - window.innerWidth,
    );
    expect(bodyOverflow).toBeLessThanOrEqual(1);
  });
});
