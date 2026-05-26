import { expect, test } from '@playwright/test';

test.describe('empty workbench', () => {
  test('proves the DS automation workflow before the first prompt', async ({ page }) => {
    await page.setViewportSize({ width: 1480, height: 960 });
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Vapor 디자인시스템 자동화 워크벤치' }),
    ).toBeVisible();
    await expect(
      page.getByText('자연어로 요청하면 Vapor 컴포넌트 코드'),
    ).toBeVisible();
    await expect(page.locator('[aria-label="검증: 대기"]')).toBeVisible();
    await expect(page.getByText('Canvas 대기')).toBeVisible();
    await expect(page.getByText('검증 게이트 준비됨')).toBeVisible();
    await expect(page.getByText('보수 루프 준비됨')).toBeVisible();
    await expect(page.getByRole('button', { name: '검증 실행' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '실패 수정' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '로컬 승인' })).toHaveCount(0);
    await expect(page.locator('iframe[title="생성물 Canvas 미리보기"]')).toHaveCount(0);

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
