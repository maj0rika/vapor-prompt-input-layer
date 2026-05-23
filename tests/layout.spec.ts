import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

test.describe('workbench layout', () => {
  for (const size of VIEWPORTS) {
    test(`has no horizontal page overflow at ${size.width}x${size.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto('/');
      await page
        .getByLabel('자동화 프롬프트 입력')
        .fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
      await page.getByRole('button', { name: '자동화 실행' }).click();
      await expect(page.getByLabel('생성물 워크스페이스')).toBeVisible({
        timeout: 6000,
      });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
