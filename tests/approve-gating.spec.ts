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
  test('(A) Approve hidden before pass, visible after pass, shows Korean confirm on click', async ({
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

    // Before any validation: Approve hidden
    await expect(page.getByRole('button', { name: '로컬 승인' })).toHaveCount(0);

    // Run validation → fail
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });

    // After fail: still hidden
    await expect(page.getByRole('button', { name: '로컬 승인' })).toHaveCount(0);

    // Run validation → pass
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.getByRole('button', { name: '로컬 승인' })).toBeVisible({
      timeout: 6000,
    });

    // After pass: visible/enabled
    await expect(page.getByRole('button', { name: '로컬 승인' })).toBeEnabled();

    // Click approve → Korean confirmation visible, button disappears
    await page.getByRole('button', { name: '로컬 승인' }).click();
    await expect(page.getByText('로컬 리뷰 승인 완료')).toBeVisible();
    await expect(
      page.getByText('로컬 리뷰 승인만 기록되었습니다. 저장소 변경이나 PR은 생성되지 않습니다.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '로컬 승인' })).toHaveCount(0);
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

    // Send first request → 기본 버튼 template
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });

    // Validate and approve first run
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.getByRole('button', { name: '로컬 승인' })).toBeVisible({
      timeout: 6000,
    });

    // Switch to a different template (토큰 동기화 mode → new artifactRun)
    await page.getByLabel('자동화 모드 선택').click();
    await page.getByRole('option', { name: '토큰 동기화' }).click();
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('token sync 요청');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    // New artifactRun: Approve must be hidden again (carry-over blocked)
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });
    await expect(page.getByRole('button', { name: '로컬 승인' })).toHaveCount(0);
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

    // Approve still hidden after fail
    await expect(page.getByRole('button', { name: '로컬 승인' })).toHaveCount(0);

    // Trigger repair → new artifactRun
    await page.getByRole('button', { name: '실패 수정' }).click();
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });

    // New artifactRun: Approve hidden (carry-over from old run blocked)
    await expect(page.getByRole('button', { name: '로컬 승인' })).toHaveCount(0);
  });
});
