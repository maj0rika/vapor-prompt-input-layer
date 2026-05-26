import { expect, test } from '@playwright/test';

test.describe('artifact canvas runtime', () => {
  test('renders the generated component inside a sandboxed canvas frame', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

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
    await expect(page.locator('[aria-label="Artifact: pass"]')).toBeVisible();
    await expect(page.locator('[aria-label="Canvas: pass"]')).toBeVisible();
    await expect(page.locator('[aria-label="Validation: waiting"]')).toBeVisible();
    await expect(page.getByText('Metadata contract: PASS')).toBeVisible();
    await expect(page.locator('[aria-label="Canvas runtime: ready"]')).toBeVisible();

    const canvas = page.frameLocator('iframe[title="Generated artifact canvas"]');
    const canvasFrame = page.locator('iframe[title="Generated artifact canvas"]');
    await expect(canvasFrame).toHaveAttribute('src', /\/api\/deepseek\/preview/);
    await expect(canvasFrame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin');
    const canvasSrc = await canvasFrame.getAttribute('src');
    expect(new URL(canvasSrc ?? '', page.url()).origin).not.toBe(new URL(page.url()).origin);
    await expect(
      canvas.getByRole('button', { name: 'Deploy component' }),
    ).toBeVisible();
    expect(consoleErrors).toEqual([]);
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

  test('runs real validation from the workspace and shows gate details', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.locator('[aria-label="Validation: active"]')).toBeVisible();
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: process.env.CI ? 60_000 : 20_000,
    });
    await page.getByRole('tab', { name: '검증' }).click();

    await expect(page.locator('[aria-label="Validation: pass"]')).toBeVisible();
    await expect(
      page.getByRole('listitem').filter({ hasText: /^Typecheck: PASS$/ }),
    ).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByRole('listitem').filter({ hasText: /^Runtime Render: PASS$/ }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: /Runtime Render: PASS.*2 metadata variants \(Default, Disabled\)/ }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: /Axe: PASS.*2 metadata variants \(Default, Disabled\)/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('listitem').filter({ hasText: /^Cleanup: PASS$/ }),
    ).toBeVisible();
  });

  test('resets validation rail when a validated artifact is regenerated', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.locator('[aria-label="Validation: pass"]')).toBeVisible({
      timeout: process.env.CI ? 60_000 : 20_000,
    });

    await page.getByRole('button', { name: '응답 재생성' }).click();
    await expect(page.locator('[aria-label="Validation: waiting"]')).toBeVisible({
      timeout: 6000,
    });
    await expect(page.locator('[aria-label="Validation: pass"]')).toHaveCount(0);
  });

  test('shows clear fail states when generated code is broken', async ({ page }) => {
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('broken raw color component 생성');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: process.env.CI ? 60_000 : 20_000,
    });
    await page.getByRole('tab', { name: '검증' }).click();

    await expect(page.locator('[aria-label="Validation: fail"]')).toBeVisible();
    await expect(
      page.getByRole('listitem').filter({ hasText: /^Vapor token usage: FAIL$/ }),
    ).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/raw color value/)).toBeVisible();
  });

  test('shows typecheck failure output from the real runner', async ({ page }) => {
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('typecheck fail component fixture');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: process.env.CI ? 60_000 : 20_000,
    });
    await page.getByRole('tab', { name: '검증' }).click();

    await expect(
      page.getByRole('listitem').filter({ hasText: /^Typecheck: FAIL$/ }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Typecheck output')).toBeVisible();
    await expect(page.getByText(/TypecheckFailButton\.tsx/)).toBeVisible();
    await expect(page.getByRole('button', { name: '실패 로그 복사' })).toBeVisible();
  });

  test('shows runtime render failure independently from unit output', async ({ page }) => {
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('runtime fail component fixture');
    await page.getByRole('button', { name: '자동화 실행' }).click();
    await expect(page.locator('[aria-label="Canvas runtime: failed"]')).toBeVisible({
      timeout: 8000,
    });

    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: process.env.CI ? 60_000 : 20_000,
    });
    await page.getByRole('tab', { name: '검증' }).click();

    await expect(
      page.getByRole('listitem').filter({ hasText: /^Unit: PASS$/ }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('listitem').filter({ hasText: /^Runtime Render: FAIL$/ }),
    ).toBeVisible();
    await expect(page.getByText('Runtime Render output')).toBeVisible();
    await expect(
      page.locator('code').filter({ hasText: /runtime render fixture failure/ }),
    ).toHaveCount(2);
  });

  test('fails wrong primaryExport metadata instead of falling back', async ({ page }) => {
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('wrong primaryExport metadata mismatch fixture');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByText('Metadata contract: FAIL')).toBeVisible({
      timeout: 6000,
    });
    await expect(page.getByText(/primaryExport "MissingActionButton"/)).toBeVisible();
    await expect(page.getByText('Canvas 사용 불가')).toBeVisible();
    await expect(page.locator('iframe[title="Generated artifact canvas"]')).toHaveCount(0);

    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: process.env.CI ? 60_000 : 20_000,
    });
    await page.getByRole('tab', { name: '검증' }).click();
    await expect(page.getByText(/Metadata contract: FAIL/).first()).toBeVisible();
    await expect(
      page.getByRole('listitem').filter({ hasText: /^Runtime Render: FAIL$/ }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/MissingActionButton/).first(),
    ).toBeVisible();
  });

  test('shows axe failure output from the accessibility runner', async ({ page }) => {
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('axe alt image failure fixture');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: 6000,
    });
    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: process.env.CI ? 60_000 : 20_000,
    });
    await page.getByRole('tab', { name: '검증' }).click();

    await expect(
      page.getByRole('listitem').filter({ hasText: /^Runtime Render: PASS$/ }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('listitem').filter({ hasText: /^Axe: FAIL$/ }),
    ).toBeVisible();
    await expect(page.getByText('Axe output')).toBeVisible();
    await expect(page.getByText(/image-alt|Images must have alternate text/)).toBeVisible();
  });

  test('repairs a failed artifact and allows approval only after pass', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByLabel('자동화 프롬프트 입력')
      .fill('broken raw color component 생성');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: process.env.CI ? 60_000 : 20_000,
    });
    await page.getByRole('tab', { name: '검증' }).click();
    await expect(
      page.getByRole('listitem').filter({ hasText: /^Vapor token usage: FAIL$/ }),
    ).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeDisabled();

    await page.getByRole('button', { name: '실패 수정 (Fix with Agent)' }).click();
    await expect(page.getByText(/실패한 validation 결과를 바탕으로 수정/)).toBeVisible();
    await expect(
      page
        .frameLocator('iframe[title="Generated artifact canvas"]')
        .getByRole('button', { name: 'Deploy component' }),
    ).toBeVisible({ timeout: 6000 });

    await page.getByRole('button', { name: '검증 실행' }).click();
    await expect(page.getByRole('button', { name: '검증 실행' })).toBeVisible({
      timeout: process.env.CI ? 60_000 : 20_000,
    });
    await page.getByRole('tab', { name: '검증' }).click();
    await expect(
      page.getByRole('listitem').filter({ hasText: /^Vapor token usage: PASS$/ }),
    ).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeEnabled();

    await page.getByRole('button', { name: '현재 artifact 로컬 승인' }).click();
    await expect(page.getByText('로컬 리뷰 승인 완료')).toBeVisible();
  });

  test('Canvas timeout 은 failed 와 구별되는 별도 상태로 표시된다', async ({ page }) => {
    // Intercept the preview endpoint so the iframe loads but never fires ready.
    await page.route('**/api/deepseek/preview**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body><p>silence</p></body></html>',
      });
    });

    await page.clock.install();

    await page.goto('/');
    await page.getByLabel('자동화 프롬프트 입력').fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByRole('tab', { name: 'Canvas' })).toBeVisible({ timeout: 6000 });

    // Advance clock past the 8-second timeout
    await page.clock.fastForward(8500);

    await expect(page.locator('[aria-label="Canvas runtime: timeout"]')).toBeVisible({
      timeout: 3000,
    });
    await expect(
      page.getByText('Canvas 런타임 응답 없음'),
    ).toBeVisible();
    // Must NOT appear as failed
    await expect(page.locator('[aria-label="Canvas runtime: failed"]')).not.toBeVisible();
  });

  test('preview endpoint 500 응답은 Canvas failed 상태로 표시된다', async ({ page }) => {
    await page.route('**/api/deepseek/preview**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'text/plain',
        body: '서버 오류',
      });
    });

    await page.goto('/');
    await page.getByLabel('자동화 프롬프트 입력').fill('primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수');
    await page.getByRole('button', { name: '자동화 실행' }).click();

    await expect(page.getByRole('tab', { name: 'Canvas' })).toBeVisible({ timeout: 6000 });
    await expect(page.locator('[aria-label="Canvas runtime: failed"]')).toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByText(/Preview endpoint failed \(500\)/)).toBeVisible();
    // Must NOT appear as timeout
    await expect(page.locator('[aria-label="Canvas runtime: timeout"]')).not.toBeVisible();
  });
});
