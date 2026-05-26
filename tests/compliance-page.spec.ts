import { test, expect } from '@playwright/test';

/**
 * CompliancePage 핵심 E2E 검증.
 * - 첫 화면이 렌더된다 (헤더 + 검사 실행 버튼)
 * - /api/compliance/report 가 200 JSON 을 반환한다
 * - 검사 실행 클릭 후 실제 엔진 결과가 화면에 반영된다
 * - 4 viewport 모두 horizontal overflow 가 0 이다
 */

test.describe('Vapor UI Compliance Workbench', () => {
  test('첫 화면이 LLM 인상 없이 렌더된다', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Vapor UI Compliance Workbench' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '검사 실행' })).toBeVisible();
    await expect(page.getByRole('button', { name: '리포트 초기화' })).toBeVisible();
    // LLM/Agent/DeepSeek/Chat 흔적 부재
    await expect(page.locator('body')).not.toContainText('DeepSeek');
    await expect(page.locator('body')).not.toContainText('Agent');
  });

  test('/api/compliance/report 가 정상 응답한다', async ({ request }) => {
    const res = await request.get('/api/compliance/report');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('overallScore');
    expect(body).toHaveProperty('overallStatus');
    expect(Array.isArray(body.gates)).toBe(true);
    expect(body.gates.length).toBeGreaterThan(0);
  });

  test('검사 실행 클릭 시 결과 패널이 갱신된다', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'Vapor UI Compliance Workbench' }).waitFor();
    const before = await page.getByText(/마지막 검사:/).textContent();

    // 타임스탬프 second 단위로 표시되므로 1초 텀이면 갱신 검증 가능.
    await page.waitForTimeout(1100);
    await page.getByRole('button', { name: '검사 실행' }).click();
    await expect
      .poll(async () => page.getByText(/마지막 검사:/).textContent(), { timeout: 10_000 })
      .not.toEqual(before);
  });

  test.describe('viewport overflow', () => {
    for (const vp of [
      { name: 'mobile-390', width: 390, height: 800 },
      { name: 'tablet-768', width: 768, height: 1024 },
      { name: 'desktop-1280', width: 1280, height: 900 },
      { name: 'desktop-1440', width: 1440, height: 900 },
    ]) {
      test(`${vp.name} → horizontal overflow ≤ 1px`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/');
        await page.getByRole('heading', { name: 'Vapor UI Compliance Workbench' }).waitFor();
        const overflow = await page.evaluate(() => ({
          doc: document.documentElement.scrollWidth - window.innerWidth,
          body: document.body.scrollWidth - window.innerWidth,
        }));
        expect(overflow.doc).toBeLessThanOrEqual(1);
        expect(overflow.body).toBeLessThanOrEqual(1);
      });
    }
  });
});
