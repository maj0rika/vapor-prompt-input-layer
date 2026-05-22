import { test, expect } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** 임시 파일을 생성하고 경로를 반환한다. */
function makeTempFile(name: string, content = 'sample'): string {
  const dir = mkdtempSync(join(tmpdir(), 'vapor-e2e-'));
  const filePath = join(dir, name);
  writeFileSync(filePath, content);
  return filePath;
}

test.describe('Prompt Input 흐름', () => {
  test('텍스트 입력 → 데이터소스 선택 → 파일 첨부 → 제출 → 초기화', async ({
    page,
  }) => {
    await page.goto('/');

    const textarea = page.getByLabel('프롬프트 입력');
    await textarea.fill('Vapor 컴포넌트에 대해 알려줘');

    // 데이터소스 선택
    await page.getByLabel('데이터소스 선택').click();
    await page.getByRole('option', { name: '웹 검색' }).click();
    await page.keyboard.press('Escape');

    // 파일 첨부
    await page
      .locator('input[type="file"]')
      .setInputFiles(makeTempFile('sample.png'));
    await expect(page.getByText(/첨부 파일 1개/)).toBeVisible();

    // 제출
    await page.getByRole('button', { name: '보내기' }).click();

    // 제출 결과가 표시되고 입력 상태가 초기화된다.
    await expect(page.getByRole('heading', { name: '제출됨' })).toBeVisible();
    await expect(textarea).toHaveValue('');
    await expect(page.getByText(/첨부 파일 1개/)).toBeHidden();
  });

  test('잘못된 형식의 파일을 첨부하면 거부 피드백을 표시한다', async ({
    page,
  }) => {
    await page.goto('/');

    await page
      .locator('input[type="file"]')
      .setInputFiles(makeTempFile('malware.exe'));

    await expect(page.getByRole('alert')).toContainText(
      '지원하지 않는 파일 형식',
    );
  });
});
