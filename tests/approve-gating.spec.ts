import { expect, test } from '@playwright/test';

const PASS_RESULT = {
  status: 'pass',
  durationMs: 50,
  details: [
    { label: 'Typecheck', status: 'pass', message: 'ok' },
    { label: 'Unit', status: 'pass', message: 'ok' },
    { label: 'Runtime Render', status: 'pass', message: 'ok' },
    { label: 'Axe', status: 'pass', message: 'ok' },
    { label: 'Vapor token usage', status: 'pass', message: 'ok' },
    { label: 'Cleanup', status: 'pass', message: 'ok' },
  ],
};

const FAIL_RESULT = {
  status: 'fail',
  durationMs: 50,
  details: [
    { label: 'Typecheck', status: 'pass', message: 'ok' },
    { label: 'Unit', status: 'pass', message: 'ok' },
    { label: 'Runtime Render', status: 'pass', message: 'ok' },
    { label: 'Axe', status: 'pass', message: 'ok' },
    { label: 'Vapor token usage', status: 'fail', message: 'raw color value detected' },
    { label: 'Cleanup', status: 'pass', message: 'ok' },
  ],
};

test.describe('Approve gating (G005)', () => {
  test('(A) Approve disabled before pass, enabled after pass, shows Korean confirm on click', async ({
    page,
  }) => {
    // First call returns fail, second returns pass
    let callCount = 0;
    await page.route('**/api/deepseek/validate', async (route) => {
      callCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(callCount === 1 ? FAIL_RESULT : PASS_RESULT),
      });
    });

    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });

    // Before any validation: Approve disabled
    await expect(page.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeDisabled();

    // Run validation → fail
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });

    // After fail: still disabled
    await expect(page.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeDisabled();

    // Run validation → pass
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });

    // After pass: enabled
    await expect(page.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeEnabled();

    // Click approve → Korean confirmation visible
    await page.getByRole('button', { name: '현재 artifact 로컬 승인' }).click();
    await expect(page.getByText('로컬 리뷰 승인 완료')).toBeVisible();
    await expect(
      page.getByText('로컬 리뷰 승인만 기록되었습니다. 저장소 변경이나 PR은 생성되지 않습니다.'),
    ).toBeVisible();
  });

  test('(B) Cross-run carryover blocked: Approve resets to disabled after template switch', async ({
    page,
  }) => {
    await page.route('**/api/deepseek/validate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PASS_RESULT),
      });
    });

    await page.goto('/');

    // Send first request → Primary Button template
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });

    // Validate and approve first run
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });
    await expect(page.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeEnabled();

    // Switch to a different template (Token Sync mode → new artifactRun)
    await page.getByLabel('자동화 모드 선택').click();
    await page.getByRole('option', { name: 'Token Sync' }).click();
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('token sync 요청');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    // New artifactRun: Approve must be disabled again (carry-over blocked)
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });
    await expect(page.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeDisabled();
  });

  test('(C) Repair carryover blocked: new artifactRun after Fix with Agent keeps Approve disabled', async ({
    page,
  }) => {
    let callCount = 0;
    await page.route('**/api/deepseek/validate', async (route) => {
      callCount += 1;
      // First validation returns fail to enable Fix with Agent
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(callCount === 1 ? FAIL_RESULT : PASS_RESULT),
      });
    });

    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('broken raw color component 생성');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });

    // Validate → fail
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });

    // Approve still disabled after fail
    await expect(page.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeDisabled();

    // Trigger repair → new artifactRun
    await page.getByRole('button', { name: '실패 수정 (Fix with Agent)' }).click();
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });

    // New artifactRun: Approve disabled (carry-over from old run blocked)
    await expect(page.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeDisabled();
  });
});
