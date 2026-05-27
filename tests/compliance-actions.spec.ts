import { test, expect } from '@playwright/test';

/**
 * CompliancePage 핵심 사용자 액션 E2E 검증.
 * 기존 compliance-page.spec.ts 가 컴포넌트 렌더링과 키보드를 검증했다면,
 * 이 파일은 실제 사용자 워크플로(초기화, 재검사, 게이트 상세 일치, 엔진 실패)를 검증한다.
 */

test.describe('compliance actions', () => {
  test('리포트 초기화 후 재검사 가능하다', async ({ page }) => {
    await page.goto('/');
    // 초기 자동 검사 결과가 로드될 때까지 대기
    await page.getByTestId('compliance-summary').waitFor({ timeout: 10_000 });

    // ---- 초기화 전: 리포트 존재 확인 ----
    await expect(page.getByTestId('compliance-summary')).toBeVisible();
    await expect(page.getByRole('listbox', { name: '게이트 선택' })).toBeVisible();

    // ---- 초기화 실행 ----
    await page.getByTestId('compliance-action-reset').click();

    // 초기화 후: compliance-summary 가 사라짐 (report === null)
    await expect(page.getByTestId('compliance-summary')).not.toBeVisible();

    // 게이트 리스트도 사라짐
    await expect(page.getByRole('listbox', { name: '게이트 선택' })).not.toBeVisible();

    // 검사 실행 / 리포트 초기화 버튼은 여전히 존재
    await expect(page.getByTestId('compliance-action-run')).toBeVisible();
    await expect(page.getByTestId('compliance-action-reset')).toBeVisible();

    // ---- 재검사 실행 ----
    await page.getByTestId('compliance-action-run').click();

    // 재검사 후 결과가 복원됨
    await page.getByTestId('compliance-summary').waitFor({ timeout: 10_000 });
    await expect(page.getByTestId('compliance-summary')).toBeVisible();
    await expect(page.getByRole('listbox', { name: '게이트 선택' })).toBeVisible();

    // 첫 번째 게이트가 선택되거나 적어도 하나의 gate list가 렌더됨
    const options = page.getByRole('listbox', { name: '게이트 선택' }).getByRole('option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThanOrEqual(4);

    // 게이트 카드 표시 확인
    await expect(page.getByTestId(/gate-card-/)).toBeVisible();
    await expect(page.getByTestId('gate-status-badge')).toBeVisible();

    // 마지막 검사 시간이 표시됨
    await expect(page.getByText(/마지막 검사:/)).toBeVisible();
  });

  test('게이트 선택 시 게이트 카드 제목이 선택 게이트와 일치한다', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('compliance-summary').waitFor({ timeout: 10_000 });

    const GATE_TITLES: Record<string, string> = {
      'layout-overflow': '레이아웃 품질',
      'responsive-design': '반응형 & 테마',
      'vapor-components': 'Vapor 컴포넌트 사용',
      'design-tokens': '토큰 & 스타일',
      accessibility: '접근성',
      'code-quality': '코드 품질',
      documentation: '문서 준비도',
    };

    const gates = Object.keys(GATE_TITLES);

    for (const gateId of gates) {
      const testId = `compliance-gate-${gateId}`;
      const gateOption = page.getByTestId(testId);

      // 게이트 항목 클릭
      await gateOption.click();

      // 해당 게이트만 선택 상태
      await expect(gateOption).toHaveAttribute('aria-selected', 'true');

      // 다른 게이트는 선택 해제
      for (const otherId of gates) {
        if (otherId === gateId) continue;
        await expect(page.getByTestId(`compliance-gate-${otherId}`)).toHaveAttribute(
          'aria-selected',
          'false',
        );
      }

      // 게이트 카드가 표시되고, 선택된 gate의 data-testid가 일치
      const gateCard = page.getByTestId(`gate-card-${gateId}`);
      await expect(gateCard).toBeVisible();

      // 게이트 카드 내 제목이 engine report 의 gate name 과 일치
      // (게이트 카드는 gate.name 을 heading 으로 렌더링함)
      const expectedName = GATE_TITLES[gateId];
      await expect(gateCard.getByText(expectedName).first()).toBeVisible();

      // 상태 배지 표시
      await expect(gateCard.getByTestId('gate-status-badge')).toBeVisible();
    }
  });

  test('엔진 실패 시 오류가 표시되고 레이아웃이 깨지지 않는다', async ({ page }) => {
    // /api/compliance/report 가 500 에러를 반환하도록 intercept
    await page.route('**/api/compliance/report', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'text/plain',
        body: 'Internal Server Error',
      }),
    );

    await page.goto('/');

    // Engine Failure 오류 표시 확인 (role="status" + data-testid)
    const errorDiv = page.getByTestId('compliance-engine-error');
    await errorDiv.waitFor({ timeout: 10_000 });
    await expect(errorDiv).toBeVisible();
    await expect(errorDiv).toContainText('Engine Failure');

    // 검사 실행 버튼이 여전히 존재 (disabled 상태 아님 — 에러 후 재시도 가능)
    const runButton = page.getByTestId('compliance-action-run');
    await expect(runButton).toBeVisible();
    await expect(runButton).toBeEnabled();

    // 리포트 초기화 버튼도 존재
    await expect(page.getByTestId('compliance-action-reset')).toBeVisible();

    // 에러 상태에서도 horizontal overflow 없음
    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth - window.innerWidth,
      body: document.body.scrollWidth - window.innerWidth,
    }));
    expect(overflow.doc).toBeLessThanOrEqual(1);
    expect(overflow.body).toBeLessThanOrEqual(1);
  });
});
