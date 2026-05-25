/**
 * Live DeepSeek smoke
 *
 * CI hard gate (verify:ci / test:e2e) 에 포함되지 않습니다.
 * `DEEPSEEK_API_KEY` 환경변수가 없으면 suite 전체를 skip 하고 exit 0 으로 종료합니다.
 *
 * 실행:
 *   DEEPSEEK_API_KEY=... npm run smoke:live-deepseek
 *
 * Scope:
 * - generation, artifact parse, workspace, Canvas iframe, raw leakage 까지만.
 * - Run validation 은 모델/네트워크 출력이 더 flaky 하므로 이 smoke 에서 자동
 *   실행하지 않습니다. UI 에서 사용자가 직접 클릭해 확인하세요.
 *
 * Starter 템플릿 클릭은 deterministic fixture 를 로드하므로 live 호출이 발생하지
 * 않습니다. live smoke 는 PromptBar 에 직접 입력해 fixture 경로를 우회합니다.
 */
import { test, expect } from '@playwright/test';

const hasApiKey = !!process.env.DEEPSEEK_API_KEY;

test.describe('Live DeepSeek smoke', () => {
  test.beforeEach(async () => {
    test.skip(!hasApiKey, 'DEEPSEEK_API_KEY 미설정 — live smoke skip');
  });

  test('generation: 자연어 요청 → 응답 + artifact + Canvas + no raw leakage', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByText('무엇을 자동화할까요?')).toBeVisible();

    // Starter fixture 경로 우회: PromptBar 에 직접 입력
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    // user 메시지 노출
    await expect(page.locator('[data-role="user"]')).toBeVisible();

    // assistant 메시지 done (live 는 느릴 수 있어 90초 허용)
    await expect
      .poll(() => page.locator('[data-role="assistant"][data-status="done"]').count(), {
        timeout: 90_000,
        intervals: [1500, 2500, 3500],
      })
      .toBeGreaterThanOrEqual(1);

    const assistant = page.locator('[data-role="assistant"][data-status="done"]').first();
    await expect(assistant).toBeVisible();

    // 1) 응답 본문이 비어 있지 않다
    const text = (await assistant.textContent())?.trim() ?? '';
    expect(text.length).toBeGreaterThan(0);

    // 2) 응답 본문에 raw artifact tag fragment 가 없다 (visibleConversationText
    //    sanitization regression guard)
    expect(text).not.toMatch(/<artifact\b/i);
    expect(text).not.toMatch(/<artifact-meta\b/i);
    expect(text).not.toMatch(/<\/artifact>/i);
    expect(text).not.toMatch(/```tsx/i);

    // 3) artifact workspace 노출
    const workspace = page.getByLabel('생성물 워크스페이스');
    await expect(workspace).toBeVisible();

    // 4) Component / Story / Test tab 모두 노출 (mode=component 응답 기대)
    await expect(page.getByRole('tab', { name: 'Component' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Story' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Test', exact: true })).toBeVisible();

    // 5) Canvas tab default 선택 + iframe 존재
    await expect(page.getByRole('tab', { name: 'Canvas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('iframe[title="Generated artifact canvas"]')).toHaveCount(1);

    // 6) Canvas runtime status 가 ready / failed / timeout 중 하나로 settled
    //    (loading 무한 대기 방지 — 30 초 안에 명시적 상태 발급)
    const canvasStatusBadge = page.locator('[aria-label^="Canvas runtime:"]');
    await expect(canvasStatusBadge).toBeVisible({ timeout: 30_000 });
    const canvasLabel = await canvasStatusBadge.first().getAttribute('aria-label');
    expect(canvasLabel).toMatch(/Canvas runtime: (ready|failed|timeout)/);
  });
});
