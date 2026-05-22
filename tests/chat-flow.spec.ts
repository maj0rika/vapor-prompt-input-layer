import { test, expect } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function makeTempFile(name: string, content = 'sample'): string {
  const dir = mkdtempSync(join(tmpdir(), 'vapor-e2e-'));
  const filePath = join(dir, name);
  writeFileSync(filePath, content);
  return filePath;
}

test.describe('Vapor DS automation flow', () => {
  test('empty state template fills the automation prompt', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('무엇을 자동화할까요?')).toBeVisible();

    await page.getByRole('button', { name: 'Primary Button' }).click();
    await expect(page.getByLabel('자동화 프롬프트 입력')).toHaveValue(
      'primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수',
    );
  });

  test('component request streams response and opens artifact workspace', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.locator('[data-role="user"]')).toBeVisible();
    await expect
      .poll(() => page.locator('[data-status="done"]').count(), {
        timeout: 6000,
      })
      .toBeGreaterThanOrEqual(2);

    const workspace = page.getByLabel('생성물 워크스페이스');
    await expect(workspace).toBeVisible();
    await expect(workspace).toContainText('PrimaryActionButton');
    await expect(workspace).toContainText('Typecheck: PASS');
    await expect(workspace).toContainText('Vapor token usage: PASS');
  });

  test('streaming can be cancelled with ESC', async ({ page }) => {
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('DataTable 컴포넌트와 story/test 생성');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.locator('[data-role="assistant"]')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByText('응답이 중단되었습니다.')).toBeVisible();
  });

  test('artifact workspace can be closed and reopened', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('자동화 프롬프트 입력').fill('a11y audit 요청');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    const workspace = page.getByLabel('생성물 워크스페이스');
    await expect(workspace).toBeVisible({ timeout: 6000 });

    await page.getByRole('button', { name: '워크스페이스 닫기' }).click();
    await expect(workspace).toBeHidden();

    await page.getByRole('button', { name: 'Artifact 보기' }).click();
    await expect(workspace).toBeVisible();
  });

  test('response regeneration keeps the original automation request', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByLabel('자동화 프롬프트 입력').fill('token sync 도와줘');
    await page.getByRole('button', { name: '자동화 실행' }).click();
    await expect
      .poll(() => page.locator('[data-status="done"]').count(), {
        timeout: 6000,
      })
      .toBeGreaterThanOrEqual(2);

    await page.getByRole('button', { name: '응답 재생성' }).click();
    await expect(page.locator('[data-role="assistant"]')).toHaveAttribute(
      'data-status',
      'streaming',
    );
    await expect
      .poll(() => page.locator('[data-status="done"]').count(), {
        timeout: 6000,
      })
      .toBeGreaterThanOrEqual(2);
  });

  test('unsupported file shows rejection feedback', async ({ page }) => {
    await page.goto('/');
    await page
      .locator('input[type="file"]')
      .setInputFiles(makeTempFile('malware.exe'));
    await expect(page.getByRole('alert')).toContainText(
      '지원하지 않는 파일 형식',
    );
  });

  test('attached token file appears in user message', async ({ page }) => {
    await page.goto('/');
    await page
      .locator('input[type="file"]')
      .setInputFiles(makeTempFile('tokens.json', '{"color.primary.500":"#0066ff"}'));
    await page.getByLabel('자동화 프롬프트 입력').fill('토큰 매핑해줘');
    await expect(page.getByText('완료')).toBeVisible();
    await page.getByRole('button', { name: '자동화 실행' }).click();

    const userBubble = page.locator('[data-role="user"]');
    await expect(userBubble).toContainText('토큰 매핑해줘');
    await expect(userBubble).toContainText('tokens.json');
  });
});
