import { expect, test } from '@playwright/test';

/**
 * Repair loop E2E tests.
 *
 * Verifies that:
 *   1. "Fix with Agent" is disabled before validation runs.
 *   2. After a validation FAIL the button becomes enabled.
 *   3. Clicking it sends a new user message whose text contains the
 *      Korean repair-context clue ("실패한 validation 결과를 바탕으로 수정").
 *   4. The repaired artifact streams in and the workspace updates.
 */
test.describe('repair-context', () => {
  test('Fix with Agent enabled after validation FAIL and sends repair context', async ({
    page,
  }) => {
    await page.goto('/');

    // Trigger the broken-token fixture so the token gate fails.
    await page.getByLabel('자동화 프롬프트 입력').fill('broken raw color component 생성');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });

    // "Fix with Agent" should be absent/disabled before validation result arrives.
    // (The button only renders after a validationResult is set.)
    await expect(page.getByRole('button', { name: '실패 수정 (Fix with Agent)' })).toHaveCount(0);

    // Run validation — the broken token artifact will produce a FAIL.
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.locator('[aria-label="Validation: fail"]')).toBeVisible({
      timeout: 20000,
    });

    // Now "Fix with Agent" must be enabled.
    await expect(page.getByRole('button', { name: '실패 수정 (Fix with Agent)' })).toBeVisible();
    await expect(page.getByRole('button', { name: '실패 수정 (Fix with Agent)' })).toBeEnabled();

    // Click it — a new user message with the repair prompt must appear.
    await page.getByRole('button', { name: '실패 수정 (Fix with Agent)' }).click();

    // The new user bubble contains Korean repair context.
    const userBubbles = page.locator('[data-role="user"]');
    await expect(userBubbles.last()).toContainText('실패한 validation 결과를 바탕으로 수정', {
      timeout: 4000,
    });

    // The assistant starts streaming the repaired artifact.
    await expect(page.locator('[data-role="assistant"]').last()).toBeVisible({ timeout: 4000 });

    // After streaming finishes the workspace updates.
    await expect
      .poll(() => page.locator('[data-status="done"]').count(), { timeout: 8000 })
      .toBeGreaterThanOrEqual(2);
  });

  test('Fix with Agent disabled when validation passes', async ({ page }) => {
    await page.goto('/');

    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.locator('[aria-label="Validation: pass"]')).toBeVisible({
      timeout: 20000,
    });

    // After a pass there are no failed gates → button must be disabled.
    await expect(page.getByRole('button', { name: '실패 수정 (Fix with Agent)' })).toBeVisible();
    await expect(page.getByRole('button', { name: '실패 수정 (Fix with Agent)' })).toBeDisabled();
  });
});
