import { expect, test } from '@playwright/test';

/**
 * 고정 샘플 E2E tests for each built-in EmptyState template.
 *
 * All four scenarios assert:
 *   - No live DeepSeek call (template click loads a fixture directly)
 *   - "고정 샘플" badge is visible
 *   - Correct artifact workspace content per mode
 */
test.describe('templates-deterministic', () => {
  // (A) 기본 버튼 — component mode, Canvas + Component + Story + Test tabs
  test('(A) 기본 버튼 fixture renders Canvas and validation path', async ({ page }) => {
    let chatCalls = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/deepseek/chat')) chatCalls += 1;
    });

    await page.goto('/');
    await expect(page.getByText('Vapor 컴포넌트 패키지를 바로 만듭니다')).toBeVisible();

    await page.getByRole('button', { name: '기본 버튼' }).click();

    // Provenance badge must show immediately
    await expect(page.getByText('고정 샘플', { exact: true })).toBeVisible({ timeout: 6000 });
    await expect(page.getByText('API 호출 없음')).toBeVisible();

    // Workspace visible with Canvas selected by default
    const workspace = page.getByLabel('생성물 워크스페이스');
    await expect(workspace).toBeVisible();
    await expect(page.getByRole('tab', { name: '미리보기' })).toHaveAttribute('aria-selected', 'true');

    // Component tab shows PrimaryActionButton
    await page.getByRole('tab', { name: '코드' }).click();
    await expect(workspace).toContainText('PrimaryActionButton');

    // Story tab present
    await expect(page.getByRole('tab', { name: '스토리' })).toBeVisible();

    // Test tab present
    await expect(page.getByRole('tab', { name: '테스트', exact: true })).toBeVisible();

    // Approve button hidden until validation passes
    await expect(page.getByRole('button', { name: '로컬 승인' })).toHaveCount(0);

    expect(chatCalls).toBe(0);
  });

  // (B) 토큰 동기화 — token-sync mode, no Canvas iframe
  test('(B) 토큰 동기화 fixture shows no Canvas iframe', async ({ page }) => {
    let chatCalls = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/deepseek/chat')) chatCalls += 1;
    });

    await page.goto('/');
    await page.getByRole('button', { name: '토큰 동기화' }).click();

    await expect(page.getByText('고정 샘플', { exact: true })).toBeVisible({ timeout: 6000 });

    // No Canvas tab and no iframe for token-sync mode
    await expect(page.getByRole('tab', { name: '미리보기' })).toHaveCount(0);
    await expect(page.locator('iframe[title="생성물 Canvas 미리보기"]')).toHaveCount(0);

    const workspace = page.getByLabel('생성물 워크스페이스');
    await expect(workspace).toBeVisible();

    // G013.1: 토큰 동기화 workspace 의 기본 탭은 '토큰 매핑' 이고 TokenSyncPanel
    // (mapping table + unknown report + generated source) 이 노출된다.
    await expect(page.getByRole('tab', { name: '토큰 매핑' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByTestId('token-sync-panel')).toBeVisible();
    await expect(page.getByTestId('token-sync-mapping-table')).toBeVisible();

    // Component 탭으로 전환하면 생성된 token map utility 코드가 보인다.
    await page.getByRole('tab', { name: '코드' }).click();
    await expect(workspace).toContainText('figmaToVaporTokenMap');

    expect(chatCalls).toBe(0);
  });

  // (C) 스토리/테스트 — story-test mode, Component + Story + Test tabs all present
  test('(C) 스토리/테스트 fixture shows Component, Story, and Test tabs', async ({ page }) => {
    let chatCalls = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/deepseek/chat')) chatCalls += 1;
    });

    await page.goto('/');
    await page.getByRole('button', { name: '스토리/테스트' }).click();

    await expect(page.getByText('고정 샘플', { exact: true })).toBeVisible({ timeout: 6000 });

    const workspace = page.getByLabel('생성물 워크스페이스');
    await expect(workspace).toBeVisible();

    await expect(page.getByRole('tab', { name: '코드' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '스토리' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '테스트', exact: true })).toBeVisible();

    await page.getByRole('tab', { name: '코드' }).click();
    await expect(workspace).toContainText('StoryTestSampleButton');

    expect(chatCalls).toBe(0);
  });

  // (D) 접근성 수정 — a11y-audit mode, component contains AccessibleAttachButton
  test('(D) 접근성 수정 fixture shows accessible component artifact', async ({ page }) => {
    let chatCalls = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/deepseek/chat')) chatCalls += 1;
    });

    await page.goto('/');
    await page.getByRole('button', { name: '접근성 수정' }).click();

    await expect(page.getByText('고정 샘플', { exact: true })).toBeVisible({ timeout: 6000 });

    const workspace = page.getByLabel('생성물 워크스페이스');
    await expect(workspace).toBeVisible();

    await page.getByRole('tab', { name: '코드' }).click();
    await expect(workspace).toContainText('AccessibleAttachButton');

    expect(chatCalls).toBe(0);
  });

  // (E) 데이터 테이블 — component mode, sortable DataTable artifact (regression for issue #4)
  test('(E) 데이터 테이블 fixture renders DataTable component (not Button)', async ({ page }) => {
    let chatCalls = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/deepseek/chat')) chatCalls += 1;
    });

    await page.goto('/');
    await page.getByRole('button', { name: '데이터 테이블' }).click();

    await expect(page.getByText('고정 샘플', { exact: true })).toBeVisible({ timeout: 6000 });

    const workspace = page.getByLabel('생성물 워크스페이스');
    await expect(workspace).toBeVisible();

    // Component tab must show DataTable, not the Button fixture
    await page.getByRole('tab', { name: '코드' }).click();
    await expect(workspace).toContainText('export function DataTable');
    await expect(workspace).not.toContainText('export function PrimaryActionButton');

    // Story and Test tabs present
    await expect(page.getByRole('tab', { name: '스토리' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '테스트', exact: true })).toBeVisible();

    expect(chatCalls).toBe(0);
  });
});
