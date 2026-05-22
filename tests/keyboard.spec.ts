import { test, expect } from '@playwright/test';

test.describe('automation composer keyboard behavior', () => {
  test('Enter submits and Shift+Enter inserts a newline', async ({ page }) => {
    await page.goto('/');

    const textarea = page.getByLabel('자동화 프롬프트 입력');
    await textarea.click();
    await textarea.fill('첫 줄');
    await textarea.press('Shift+Enter');
    await page.keyboard.type('둘째 줄');
    await expect(textarea).toHaveValue('첫 줄\n둘째 줄');

    await textarea.press('Enter');
    await expect(page.locator('[data-role="user"]')).toContainText('첫 줄');
    await expect(textarea).toHaveValue('');
  });

  test('ESC closes the automation mode menu', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('자동화 모드 선택').click();
    await expect(page.getByRole('option', { name: 'Component' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('option', { name: 'Component' })).toBeHidden();
  });

  test('keyboard opens the inline file chooser', async ({ page }) => {
    await page.goto('/');

    const attachButton = page.getByRole('button', { name: '참고 파일 첨부' });
    await attachButton.focus();
    await expect(attachButton).toBeFocused();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    const fileChooser = await fileChooserPromise;
    expect(fileChooser.element()).toBeTruthy();
  });

  test('Tab moves from mode selector to attach button to prompt input', async ({
    page,
  }) => {
    await page.goto('/');

    const mode = page.getByLabel('자동화 모드 선택');
    await mode.focus();
    await expect(mode).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: '참고 파일 첨부' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('자동화 프롬프트 입력')).toBeFocused();
  });
});
