import { expect, test } from '@playwright/test';

test.describe('artifact canvas runtime', () => {
  test('renders the generated component inside a sandboxed canvas frame', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByRole('tab', { name: 'Canvas' })).toBeVisible({
      timeout: 6000,
    });
    await expect(page.getByRole('tab', { name: 'Canvas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    const canvas = page.frameLocator('iframe[title="Generated artifact canvas"]');
    await expect(
      canvas.getByRole('button', { name: 'Deploy component' }),
    ).toBeVisible();
  });

  test('switches canvas variants and theme', async ({ page }) => {
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByRole('tab', { name: 'Canvas' })).toBeVisible({
      timeout: 6000,
    });
    await page.getByRole('button', { name: 'Disabled variant' }).click();

    const canvas = page.frameLocator('iframe[title="Generated artifact canvas"]');
    await expect(
      canvas.getByRole('button', { name: 'Deploy component' }),
    ).toBeDisabled();

    await page.getByRole('button', { name: 'Dark theme' }).click();
    await expect(canvas.locator('body')).toHaveAttribute('data-theme', 'dark');
  });
});
