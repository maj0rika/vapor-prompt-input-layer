import { expect, test } from '@playwright/test';

/**
 * Visual regression baseline for core workbench surfaces.
 *
 * 첫 실행 시 baseline png 가 tests/visual-regression.spec.ts-snapshots/ 에
 * 생성됩니다. 동일 환경에서 재실행하면 diff 가 threshold 이내여야 합니다.
 *
 * Threshold maxDiffPixelRatio: 0.02 (font hinting, sub-pixel anti-aliasing
 * 차이를 허용하되 의미 있는 레이아웃 회귀는 잡습니다).
 *
 * 모든 시나리오는 deterministic fixture 를 사용하므로 live DeepSeek 호출이
 * 없어 결정적입니다.
 */
test.describe('visual regression', () => {
  const snapshotOptions = {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled' as const,
  };

  test('(1) empty workbench', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.getByText('무엇을 자동화할까요?')).toBeVisible();
    await expect(page).toHaveScreenshot('empty-workbench-1280.png', snapshotOptions);
  });

  test('(2) 기본 버튼 fixture loaded — Canvas tab', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: '기본 버튼' }).click();

    await expect(page.getByText('고정 샘플', { exact: true })).toBeVisible({
      timeout: 6000,
    });
    await expect(page.getByLabel('생성물 워크스페이스')).toBeVisible();

    // Canvas tab default 선택 상태 확인 후 screenshot
    await expect(page.getByRole('tab', { name: 'Canvas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // iframe 로드 안정화 대기
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('primary-button-canvas-1280.png', snapshotOptions);
  });

  test('(3) 토큰 동기화 fixture — non-visual workspace', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: '토큰 동기화' }).click();

    await expect(page.getByText('고정 샘플', { exact: true })).toBeVisible({
      timeout: 6000,
    });
    await expect(page.getByLabel('생성물 워크스페이스')).toBeVisible();
    // Canvas tab 이 없어야 함 (token-sync non-visual contract)
    await expect(page.getByRole('tab', { name: 'Canvas' })).toHaveCount(0);

    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('token-sync-workspace-1280.png', snapshotOptions);
  });

  test('(4) empty workbench at mobile 390', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByText('무엇을 자동화할까요?')).toBeVisible();
    await expect(page).toHaveScreenshot('empty-workbench-390.png', snapshotOptions);
  });

  test('(5) Verified sample loaded — pre-validation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: '검증 샘플 실행' }).click();
    await expect(page.getByText('고정 샘플', { exact: true })).toBeVisible({
      timeout: 6000,
    });
    await expect(page.getByLabel('생성물 워크스페이스')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('verified-sample-loaded-1280.png', snapshotOptions);
  });

  test('(6) Validation pass — structured ValidationPanel + Approve enabled', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/api/deepseek/validate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'pass',
          durationMs: 50,
          details: [
            { label: 'Typecheck', status: 'pass', message: 'ok', durationMs: 12 },
            { label: 'Unit', status: 'pass', message: 'ok', durationMs: 18 },
            { label: 'Runtime Render', status: 'pass', message: 'ok', durationMs: 14 },
            { label: 'Axe', status: 'pass', message: 'ok', durationMs: 6 },
            { label: 'Vapor token usage', status: 'pass', message: 'ok', durationMs: 1 },
            { label: 'Cleanup', status: 'pass', message: 'ok' },
          ],
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: '기본 버튼' }).click();
    await expect(page.getByLabel('생성물 워크스페이스')).toBeVisible();
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(
      page.getByRole('button', { name: '로컬 승인' }),
    ).toBeVisible({ timeout: 10_000 });

    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('validation-pass-approve-1280.png', snapshotOptions);
  });

  test('(7) Metadata contract FAIL state', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('wrong primaryExport metadata mismatch fixture');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByText('Metadata contract: FAIL').first()).toBeVisible({
      timeout: 6000,
    });
    await expect(page.getByText('Canvas 사용 불가')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('metadata-fail-1280.png', snapshotOptions);
  });

  test('(8) Canvas runtime failure state', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('runtime render fixture failure');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByLabel('생성물 워크스페이스')).toBeVisible();
    await page.getByRole('button', { name: '검증 실행' }).click();
    await page.getByRole('tab', { name: '검증' }).click();
    // Wait for validation to settle
    await page.waitForTimeout(3000);
    await expect(page).toHaveScreenshot('runtime-fail-validation-1280.png', snapshotOptions);
  });
});
