import { expect, test } from '@playwright/test';

/**
 * Deterministic fixture E2E tests for each built-in EmptyState template.
 *
 * All four scenarios assert:
 *   - No live DeepSeek call (template click loads a fixture directly)
 *   - "Deterministic fixture" badge is visible
 *   - Correct artifact workspace content per mode
 */
test.describe('templates-deterministic', () => {
  // (A) Primary Button — component mode, Canvas + Component + Story + Test tabs
  test('(A) Primary Button fixture renders Canvas and validation path', async ({ page }) => {
    let chatCalls = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/deepseek/chat')) chatCalls += 1;
    });

    await page.goto('/');
    await expect(page.getByText('무엇을 자동화할까요?')).toBeVisible();

    await page.getByRole('button', { name: 'Primary Button' }).click();

    // Provenance badge must show immediately
    await expect(page.getByText('Deterministic fixture')).toBeVisible({ timeout: 6000 });
    await expect(page.getByText('No DeepSeek call')).toBeVisible();

    // Workspace visible with Canvas selected by default
    const workspace = page.getByLabel('생성물 워크스페이스');
    await expect(workspace).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Canvas' })).toHaveAttribute('aria-selected', 'true');

    // Component tab shows PrimaryActionButton
    await page.getByRole('tab', { name: 'Component' }).click();
    await expect(workspace).toContainText('PrimaryActionButton');

    // Story tab present
    await expect(page.getByRole('tab', { name: 'Story' })).toBeVisible();

    // Test tab present
    await expect(page.getByRole('tab', { name: 'Test', exact: true })).toBeVisible();

    // Approve button disabled until validation passes
    await expect(page.getByRole('button', { name: 'Approve current artifact' })).toBeDisabled();

    expect(chatCalls).toBe(0);
  });

  // (B) Token Sync — token-sync mode, no Canvas iframe
  test('(B) Token Sync fixture shows no Canvas iframe', async ({ page }) => {
    let chatCalls = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/deepseek/chat')) chatCalls += 1;
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Token Sync' }).click();

    await expect(page.getByText('Deterministic fixture')).toBeVisible({ timeout: 6000 });

    // No Canvas tab and no iframe for token-sync mode
    await expect(page.getByRole('tab', { name: 'Canvas' })).toHaveCount(0);
    await expect(page.locator('iframe[title="Generated artifact canvas"]')).toHaveCount(0);

    // Component tab (first available) shows the token map identifier
    const workspace = page.getByLabel('생성물 워크스페이스');
    await expect(workspace).toBeVisible();
    await expect(workspace).toContainText('figmaToVaporTokenMap');

    expect(chatCalls).toBe(0);
  });

  // (C) Story/Test — story-test mode, Component + Story + Test tabs all present
  test('(C) Story/Test fixture shows Component, Story, and Test tabs', async ({ page }) => {
    let chatCalls = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/deepseek/chat')) chatCalls += 1;
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Story / Test' }).click();

    await expect(page.getByText('Deterministic fixture')).toBeVisible({ timeout: 6000 });

    const workspace = page.getByLabel('생성물 워크스페이스');
    await expect(workspace).toBeVisible();

    await expect(page.getByRole('tab', { name: 'Component' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Story' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Test', exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Component' }).click();
    await expect(workspace).toContainText('StoryTestSampleButton');

    expect(chatCalls).toBe(0);
  });

  // (D) A11y Fix — a11y-audit mode, component contains AccessibleAttachButton
  test('(D) A11y Fix fixture shows accessible component artifact', async ({ page }) => {
    let chatCalls = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/deepseek/chat')) chatCalls += 1;
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'A11y Fix' }).click();

    await expect(page.getByText('Deterministic fixture')).toBeVisible({ timeout: 6000 });

    const workspace = page.getByLabel('생성물 워크스페이스');
    await expect(workspace).toBeVisible();

    await page.getByRole('tab', { name: 'Component' }).click();
    await expect(workspace).toContainText('AccessibleAttachButton');

    expect(chatCalls).toBe(0);
  });
});
