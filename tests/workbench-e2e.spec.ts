import { expect, test } from '@playwright/test';
import { mockDeepSeekChat } from './fixtures/chat-mock';

/**
 * 자연어 path E2E.
 *
 * /api/deepseek/chat 는 mockDeepSeekChat 으로 가로채 deterministic artifact 를
 * 반환한다. /api/deepseek/validate 는 실제 로컬 runner 로 보낸다 — pass 게이트
 * 가 실제로 실행되어야 한다는 사용자 contract 를 깨지 않는다.
 */

test.describe('workbench E2E — natural language', () => {
  test('(1) component 자연어 → artifact workspace + validation pass + 로컬 승인', async ({
    page,
  }) => {
    await mockDeepSeekChat(page);

    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      // selectScript fixture matcher 가 token/a11y 키워드에 우선 매칭되므로
      // NL prompt 는 DEFAULT (component) 분기를 타도록 의도적으로 일반적인
      // 문장으로 작성한다.
      .fill('Primary 버튼 컴포넌트를 새로 만들어줘. 다크 모드 지원, Tooltip 포함.');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    const assistant = page.locator('[data-role="assistant"]').first();
    await expect(assistant).toBeVisible({ timeout: 8000 });
    const assistantText = (await assistant.textContent()) ?? '';
    expect(assistantText).not.toMatch(/<artifact\b/i);
    expect(assistantText).not.toMatch(/<artifact-meta\b/i);
    expect(assistantText).not.toMatch(/<\/artifact>/i);
    expect(assistantText).not.toMatch(/```tsx/i);
    expect(assistantText.trim()).not.toBe('');

    await expect(page.getByLabel('생성물 워크스페이스')).toBeVisible();
    await expect(page.getByTestId('workspace-action-validate')).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByTestId('workspace-action-approve')).toHaveCount(0);

    await page.getByTestId('workspace-action-validate').click();
    // pipeline rail 은 2nd draft replace 시 idle 로 잠깐 reset 될 수 있어
    // 직접 buttonsibility 로 pass 여부를 판단한다.
    const approve = page.getByTestId('workspace-action-approve');
    await expect(approve).toBeVisible({ timeout: process.env.CI ? 60_000 : 20_000 });
    await approve.click();
    await expect(page.getByText('로컬 리뷰 승인 완료')).toBeVisible();
    await expect(page.getByTestId('workspace-action-approve')).toHaveCount(0);
  });

  test('(2) token-sync 자연어 → token mapping workspace, Canvas 강제 없음', async ({
    page,
  }) => {
    await mockDeepSeekChat(page, { mode: 'token-sync' });

    await page.goto('/');
    await page.getByLabel('자동화 모드 선택').click();
    await page.getByRole('option', { name: '토큰 동기화' }).click();
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill(
        'Figma Variables JSON을 Vapor token mapping으로 변환하는 유틸을 만들어줘. unknown token report와 unit test도 포함해줘.',
      );
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByLabel('생성물 워크스페이스')).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByTestId('workspace-action-validate')).toBeVisible();

    // token-sync 는 Canvas iframe 을 마운트하지 않아야 한다.
    await expect(
      page.locator('iframe[title="생성물 Canvas 미리보기"]'),
    ).toHaveCount(0);
    // 토큰 매핑 탭이 등장하고 활성화 가능해야 한다.
    await expect(page.getByRole('tab', { name: '토큰 매핑' })).toBeVisible();
    // 검증 전에는 승인 버튼이 DOM 에 없다.
    await expect(page.getByTestId('workspace-action-approve')).toHaveCount(0);
  });

  test('(3) failure fixture → 실패 게이트 + 실패 수정/실패 로그 복사 visible, 승인 hidden', async ({
    page,
  }) => {
    // selectScript 는 "raw|broken|깨진" 키워드로 BROKEN_ARTIFACT 를 반환한다.
    await mockDeepSeekChat(page);

    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('의도적으로 깨진 raw color component 만들어줘');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByTestId('workspace-action-validate')).toBeVisible({
      timeout: 8000,
    });
    await page.getByTestId('workspace-action-validate').click();

    // 실패 게이트 가 있을 때만 repair/copy-failure 버튼 이 나타난다.
    await expect(page.getByTestId('workspace-action-repair')).toBeVisible({
      timeout: process.env.CI ? 60_000 : 20_000,
    });
    await expect(page.getByTestId('workspace-action-copy-failure')).toBeVisible();
    await expect(page.getByTestId('workspace-action-approve')).toHaveCount(0);
  });

  test('(5) 디버그 탭 — agent client trace (request payload + raw response)', async ({
    page,
  }) => {
    await mockDeepSeekChat(page);

    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('Primary 버튼 컴포넌트 생성');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    const debugTab = page.getByRole('tab', { name: '디버그' });
    await expect(debugTab).toBeVisible({ timeout: 10_000 });
    await debugTab.click();

    await expect(page.getByTestId('debug-trace-status')).toHaveText(/완료|오류/);
    await expect(page.getByTestId('debug-request-body')).toContainText('Primary 버튼');
    // mock SSE 응답은 artifact 본문을 포함한다.
    await expect(page.getByTestId('debug-response-body')).toContainText('artifact');
  });

  test('(6) export default 식별자 + primaryExport="default" 응답도 Canvas 가 실제로 렌더된다', async ({
    page,
  }) => {
    // 실 DeepSeek 가 다음 패턴으로 emit 하는 경우 회귀:
    //   - artifact-meta 가 ```json 펜스로 감싸짐
    //   - primaryExport = "default"
    //   - artifact 본문이 `const X = ...; export default X` 형태
    // 이전에는 metadata 검증이 fail 로 떨어지고 Canvas 가 마운트되지 않았다.
    const ARTIFACT = `<artifact-meta>
\`\`\`json
{
  "componentName": "PrimaryActionButton",
  "primaryExport": "default",
  "defaultProps": { "children": "Deploy component" },
  "variants": [
    { "name": "Default", "props": { "children": "Deploy component" } }
  ]
}
\`\`\`
</artifact-meta>

<artifact type="component" filename="PrimaryActionButton.tsx">
\`\`\`tsx
import { Button } from '@vapor-ui/core';

const PrimaryActionButton = ({ children, disabled = false }: { children: string; disabled?: boolean }) => (
  <Button type="button" colorPalette="primary" disabled={disabled}>{children}</Button>
);

export default PrimaryActionButton;
\`\`\`
</artifact>
`;

    await mockDeepSeekChat(page, { artifactOverride: ARTIFACT });

    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('Primary 버튼 컴포넌트 만들어줘');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByLabel('생성물 워크스페이스')).toBeVisible({
      timeout: 8000,
    });
    // 메타데이터가 fail 이 아니어야 Canvas 가 마운트된다. componentName 과
    // primaryExport 가 다르므로 'warn' 등급이지만 fail 은 아님.
    await expect(page.getByText('Canvas 사용 불가')).toHaveCount(0);
    await expect(page.locator('iframe[title="생성물 Canvas 미리보기"]')).toBeVisible({
      timeout: 10_000,
    });
    // iframe 안에서 실제 컴포넌트가 렌더되었는지 확인.
    await expect(
      page
        .frameLocator('iframe[title="생성물 Canvas 미리보기"]')
        .getByRole('button', { name: 'Deploy component' }),
    ).toBeVisible({ timeout: 12_000 });
  });

  test('(4) viewport 1480: 자연어 component 흐름 후에도 horizontal overflow 없음', async ({
    page,
  }) => {
    await mockDeepSeekChat(page);
    await page.setViewportSize({ width: 1480, height: 960 });

    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('Primary Button 컴포넌트 만들어줘');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByLabel('생성물 워크스페이스')).toBeVisible({
      timeout: 8000,
    });

    const docOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(docOverflow).toBeLessThanOrEqual(1);
    const bodyOverflow = await page.evaluate(
      () => document.body.scrollWidth - window.innerWidth,
    );
    expect(bodyOverflow).toBeLessThanOrEqual(1);
  });
});
