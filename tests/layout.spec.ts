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
      const bodyOverflow = await page.evaluate(
        () => document.body.scrollWidth - window.innerWidth,
      );
      expect(bodyOverflow).toBeLessThanOrEqual(1);

      if (size.width < 768) {
        const workspaceBox = await page.getByLabel('생성물 워크스페이스').boundingBox();
        if (!workspaceBox) throw new Error('workspace layout missing');
        expect(workspaceBox.width).toBeGreaterThan(size.width * 0.9);
      }
    });
  }

  test('resizes the artifact workspace with the splitter', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    const workspace = page.getByLabel('생성물 워크스페이스');
    await expect(workspace).toBeVisible({ timeout: 6000 });
    const before = await workspace.boundingBox();

    const splitter = page.getByRole('button', {
      name: /Artifact workspace width/,
    });
    const splitterBox = await splitter.boundingBox();
    if (!before || !splitterBox) throw new Error('splitter layout missing');

    await page.mouse.move(splitterBox.x + splitterBox.width / 2, splitterBox.y + 20);
    await page.mouse.down();
    await page.mouse.move(splitterBox.x - 120, splitterBox.y + 20);
    await page.mouse.up();

    const after = await workspace.boundingBox();
    if (!after) throw new Error('workspace layout missing after resize');
    expect(after.width).toBeGreaterThan(before.width + 80);
  });

  test('keeps the desktop split divider at full body height', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    const workspace = page.getByLabel('생성물 워크스페이스');
    await expect(workspace).toBeVisible({ timeout: 6000 });

    const splitter = page.getByRole('button', {
      name: /Artifact workspace width/,
    });
    await expect(splitter).toBeVisible();

    const heights = await page.evaluate(() => {
      const workspaceElement = document.querySelector<HTMLElement>(
        '[aria-label="생성물 워크스페이스"]',
      );
      const splitterElement = document.querySelector<HTMLElement>(
        '[aria-label^="Artifact workspace width"]',
      );
      const splitBody = workspaceElement?.parentElement?.parentElement;
      if (!workspaceElement || !splitterElement || !splitBody) {
        throw new Error('split layout missing');
      }

      return {
        body: splitBody.getBoundingClientRect().height,
        splitter: splitterElement.getBoundingClientRect().height,
        workspace: workspaceElement.getBoundingClientRect().height,
      };
    });

    expect(heights.workspace).toBeGreaterThan(heights.body - 1);
    expect(heights.splitter).toBeGreaterThan(heights.body - 1);
  });
});
