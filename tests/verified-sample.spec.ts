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
    await page.getByRole('button', { name: '검증 샘플 실행' }).click();

    await expect(page.getByLabel('검증 샘플 출처')).toBeVisible();
    await expect(page.getByText('고정 샘플', { exact: true })).toBeVisible();
    await expect(page.getByText('API 호출 없음')).toBeVisible();
    await expect(page.getByText('동일 파서')).toBeVisible();
    await expect(page.getByText('동일 Canvas 런타임')).toBeVisible();
    await expect(page.getByText('동일 검증 러너')).toBeVisible();
    await expect(page.locator('[aria-label="검증: 대기"]')).toBeVisible();
    await expect(page.getByText('검증 대기: 실행 전')).toBeVisible();
    await expect(page.getByRole('button', { name: '로컬 승인' })).toHaveCount(0);
    expect(chatCalls).toBe(0);
    expect(validationCalls).toBe(0);

    await expect(page.getByRole('tab', { name: '미리보기' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('tab', { name: '코드' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '스토리' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '테스트', exact: true })).toBeVisible();
    await expect(
      page
        .frameLocator('iframe[title="생성물 Canvas 미리보기"]')
        .getByRole('button', { name: 'Deploy component' }),
    ).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('메타데이터: 통과')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disabled 상태' })).toBeVisible();

    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.locator('[aria-label="검증: 진행 중"]')).toBeVisible();
    await expect.poll(() => validationCalls).toBeGreaterThan(0);

    await expect(page.locator('[aria-label="검증: 완료"]')).toBeVisible({
      timeout: process.env.CI ? 60_000 : 20_000,
    });
    await page.getByRole('tab', { name: '검증' }).click();
    await expect(
      page.getByText('타입 검사: 통과').first(),
    ).toBeVisible();
    await expect(
      page.getByText('런타임 렌더: 통과').first(),
    ).toBeVisible();
    await expect(
      page.getByText(/런타임 렌더: 통과[\s\S]*2 metadata variants \(Default, Disabled\)/),
    ).toBeVisible();
    await expect(
      page.getByText('정리: 통과').first(),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '로컬 승인' })).toBeVisible();
    expect(chatCalls).toBe(0);
  });
});
