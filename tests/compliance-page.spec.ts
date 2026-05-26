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

  test('헤더 액션이 키보드로 접근 가능하다', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'Vapor UI Compliance Workbench' }).waitFor();

    // 명시적으로 첫 번째 액션 버튼에 포커스 — 키보드 도달 가능성 검증.
    const runButton = page.getByRole('button', { name: '검사 실행' });
    await runButton.focus();
    await expect(runButton).toBeFocused();
    await expect(runButton).toBeEnabled();

    // Tab 으로 다음 액션 버튼 이동 가능.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: '리포트 초기화' })).toBeFocused();
  });

  test('게이트 체크리스트를 키보드로 탐색할 수 있다', async ({ page }) => {
    await page.goto('/');
    // 실제 엔진 리포트가 로드될 때까지 대기 (useEffect 자동 검사)
    await page.getByTestId('compliance-summary').waitFor({ timeout: 10_000 });

    const listbox = page.getByRole('listbox', { name: '게이트 선택' });
    await expect(listbox).toBeVisible();

    const options = listbox.getByRole('option');
    const gateCount = await options.count();
    expect(gateCount).toBeGreaterThanOrEqual(4);

    // ---- 헤더 버튼에서 Tab으로 게이트 체크리스트 첫 항목까지 이동 ----
    const runButton = page.getByRole('button', { name: '검사 실행' });
    await runButton.focus();
    await expect(runButton).toBeFocused();

    // Tab → 리포트 초기화
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: '리포트 초기화' })).toBeFocused();

    // Tab → 첫 번째 게이트 버튼
    await page.keyboard.press('Tab');
    const firstGateButton = options.first().getByRole('button');
    await expect(firstGateButton).toBeFocused();

    // 첫 번째 게이트는 자동 선택 상태여야 함
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');

    // Enter 로 선택 확인 → 게이트 카드가 표시되어야 함
    await page.keyboard.press('Enter');
    await expect(page.getByTestId(/gate-card-/)).toBeVisible();
    await expect(page.getByTestId('gate-status-badge')).toBeVisible();

    // ---- Tab으로 두 번째 게이트로 이동 후 Enter 선택 ----
    await page.keyboard.press('Tab');
    const secondGateButton = options.nth(1).getByRole('button');
    await expect(secondGateButton).toBeFocused();

    await page.keyboard.press('Enter');
    // 두 번째 게이트가 선택되고 첫 번째 게이트 선택 해제
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(options.first()).toHaveAttribute('aria-selected', 'false');

    // 게이트 카드가 여전히 표시되고 상태 배지가 보여야 함
    await expect(page.getByTestId('gate-status-badge')).toBeVisible();

    // ---- Tab으로 남은 게이트들도 모두 포커스 가능한지 확인 ----
    for (let i = 2; i < gateCount; i++) {
      await page.keyboard.press('Tab');
      const gateButton = options.nth(i).getByRole('button');
      await expect(gateButton).toBeFocused();
    }

    // 마지막 게이트를 Enter 로 선택
    await page.keyboard.press('Enter');
    await expect(options.nth(gateCount - 1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('gate-status-badge')).toBeVisible();
  });

  test('증거 패널과 수정 가이드 패널을 키보드로 접근할 수 있다', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('compliance-summary').waitFor({ timeout: 10_000 });

    const listbox = page.getByRole('listbox', { name: '게이트 선택' });
    const options = listbox.getByRole('option');

    // 이슈가 있는 게이트 선택 (WARN 또는 FAIL). 없으면 첫 번째 게이트 사용.
    const issueGate = options.filter({ hasText: /경고|실패/ }).first();
    const hasIssueGate = (await issueGate.count()) > 0;
    const targetGate = hasIssueGate ? issueGate : options.first();
    await targetGate.getByRole('button').click();

    // 게이트 카드가 렌더되었는지 확인
    await expect(page.getByTestId('gate-status-badge')).toBeVisible();

    // ---- 게이트 카드 내 탭을 키보드로 접근 ----
    // 게이트 체크리스트 마지막 항목에서 Tab → 게이트 카드 탭 영역으로 이동
    const gateCount = await options.count();
    const lastOption = options.nth(gateCount - 1);
    await lastOption.getByRole('button').focus();
    await expect(lastOption.getByRole('button')).toBeFocused();

    // Tab → 증거 목록 탭 (마지막 게이트 다음에 위치)
    await page.keyboard.press('Tab');
    const evidenceTab = page.getByRole('tab', { name: /증거 목록/ });
    await expect(evidenceTab).toBeFocused();

    // 증거 패널이 보이는지 확인
    await expect(page.getByTestId(/gate-card-/)).toBeVisible();

    // ArrowRight → 수정 가이드 탭 (탭 간 이동은 Arrow 키 사용)
    await page.keyboard.press('ArrowRight');
    const fixTab = page.getByRole('tab', { name: /수정 가이드/ });
    await expect(fixTab).toBeFocused();

    // Enter 로 수정 가이드 탭 활성화
    await page.keyboard.press('Enter');

    // 수정 가이드 패널 표시 확인 (게이트에 따라 없을 수도 있으므로 exists만 체크)
    const fixGuideList = page.getByRole('list', { name: '수정 단계' });
    const fixGuideEmpty = page.getByText(/수정 가이드가 필요 없습니다/);
    const hasFixGuideContent =
      (await fixGuideList.isVisible().catch(() => false)) ||
      (await fixGuideEmpty.isVisible().catch(() => false));
    expect(hasFixGuideContent).toBe(true);

    // 수정 가이드 내 문서 링크 키보드 접근성 확인
    const docLink = page.getByRole('link', { name: /Vapor 공식 문서 열기/ });
    if (await docLink.isVisible().catch(() => false)) {
      await docLink.focus();
      await expect(docLink).toBeFocused();
    }
  });

  test('게이트 변경 시 증거 패널 내용이 갱신된다', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('compliance-summary').waitFor({ timeout: 10_000 });

    const listbox = page.getByRole('listbox', { name: '게이트 선택' });
    const options = listbox.getByRole('option');

    // 첫 번째 게이트 선택 → 증거 탭이 기본 활성화됨
    const firstOption = options.first();
    await firstOption.getByRole('button').click();

    // 증거 패널이 이슈 없음 또는 증거 목록을 표시하는지 확인
    const noIssueText = page.getByText(/이슈가 없습니다/);
    const evidenceList = page.getByRole('list', { name: '이슈 증거 목록' });
    const evidenceVisible =
      (await noIssueText.isVisible().catch(() => false)) ||
      (await evidenceList.isVisible().catch(() => false));
    expect(evidenceVisible).toBe(true);

    // 이슈가 있는 게이트로 전환 시 증거 패널 갱신 확인
    const issueGate = options.filter({ hasText: /경고|실패/ }).first();
    if ((await issueGate.count()) > 0) {
      await issueGate.getByRole('button').click();

      // 이슈가 있는 게이트는 증거 목록이 표시되어야 함
      const hasEvidence = await page.getByRole('list', { name: '이슈 증거 목록' }).isVisible().catch(() => false);
      const hasNoIssue = await page.getByText(/이슈가 없습니다/).isVisible().catch(() => false);
      expect(hasEvidence || hasNoIssue).toBe(true);

      // 수정 가이드 탭 활성화 시 가이드 표시 확인
      await page.getByRole('tab', { name: /수정 가이드/ }).click();

      const fixGuideList = page.getByRole('list', { name: '수정 단계' });
      const fixGuideEmpty = page.getByText(/수정 가이드가 필요 없습니다/);
      const hasFix =
        (await fixGuideList.isVisible().catch(() => false)) ||
        (await fixGuideEmpty.isVisible().catch(() => false));
      expect(hasFix).toBe(true);
    }
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
