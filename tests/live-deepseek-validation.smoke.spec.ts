/**
 * Live DeepSeek validation smoke (G012)
 *
 * CI hard gate 에 포함되지 않습니다. 별도 npm script `smoke:live-deepseek:validation`
 * 에서만 실행되며, `DEEPSEEK_API_KEY` 미설정 시 suite 전체 skip + exit 0.
 *
 * Scope: live generation → Run validation → ValidationPanel 가시성 → 실패 시
 * failure reason UI 노출 + raw artifact leakage 절대 금지.
 *
 * 모델/네트워크 변동성으로 validation FAIL 자체는 smoke fail 로 간주하지 않는다.
 * 단, failure reason 이 ValidationPanel 에 노출되지 않거나 leakage 가 발생하면 fail.
 */
import { test, expect } from '@playwright/test';

const hasApiKey = !!process.env.DEEPSEEK_API_KEY;

test.describe('Live DeepSeek validation smoke', () => {
  test.beforeEach(async () => {
    test.skip(!hasApiKey, 'DEEPSEEK_API_KEY 미설정 — live validation smoke skip');
  });

  test('generation → Run validation → ValidationPanel 노출 + no leakage', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByText('무엇을 자동화할까요?')).toBeVisible();

    // PromptBar 에 직접 입력해 live 경로 강제 (starter 템플릿은 fixture)
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    // assistant done 대기 (live 는 느릴 수 있어 90초 허용)
    await expect
      .poll(() => page.locator('[data-role="assistant"][data-status="done"]').count(), {
        timeout: 90_000,
        intervals: [1500, 2500, 3500],
      })
      .toBeGreaterThanOrEqual(1);

    const assistant = page.locator('[data-role="assistant"][data-status="done"]').first();
    const assistantText = (await assistant.textContent())?.trim() ?? '';

    // raw artifact tag leakage 절대 금지 (smoke hard guard)
    expect(assistantText).not.toMatch(/<artifact\b/i);
    expect(assistantText).not.toMatch(/<artifact-meta\b/i);
    expect(assistantText).not.toMatch(/<\/artifact>/i);
    expect(assistantText).not.toMatch(/```tsx/i);

    // artifact workspace 존재
    const workspace = page.getByLabel('생성물 워크스페이스');
    await expect(workspace).toBeVisible();

    // Run validation 클릭 — live validation runner 실행
    const runValidation = page.getByRole('button', { name: '검증 실행' });
    await expect(runValidation).toBeVisible({ timeout: 30_000 });
    await runValidation.click();

    // ValidationPanel 활성 (Tests 탭)
    const testsTab = page.getByRole('tab', { name: 'Tests' });
    await testsTab.click();

    // 전체 상태 badge 노출 (Pass / Fail / Warn) — 어느 결과든 60초 내 settled
    const statusBadge = page.locator('[aria-label^="전체 상태:"]');
    await expect(statusBadge).toBeVisible({ timeout: 60_000 });
    const stateLabel = await statusBadge.first().getAttribute('aria-label');
    expect(stateLabel).toMatch(/전체 상태: (Pass|Fail|Warn)/);

    // gate count summary 노출 (예: "6 gates · ...")
    await expect(page.getByText(/\d+ gates · /)).toBeVisible();

    // 실패한 gate 가 있다면 failure reason 이 UI 에 보여야 함 (validation-output-*
    // testid 가 최소 한 개 존재 — 실패 gate output disclosure 가 기본 펼쳐짐)
    if (stateLabel?.includes('Fail')) {
      const failedOutputs = page.locator('[data-testid^="validation-output-"]');
      await expect(failedOutputs.first()).toBeVisible();
    }

    // 통과 시 Approve 버튼 enabled, 실패 시 disabled (G005 invariant 회귀 가드)
    const approveBtn = page.getByRole('button', { name: '현재 artifact 로컬 승인' });
    if (stateLabel?.includes('Pass')) {
      await expect(approveBtn).toBeEnabled();
    } else {
      await expect(approveBtn).toBeDisabled();
    }
  });
});
