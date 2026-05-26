/**
 * Headless smoke test for CompliancePage.
 * - 4 viewports × 2 themes (light/dark) = 8 captures
 * - Asserts no console error per (viewport, theme)
 * - Asserts no horizontal overflow (document.scrollWidth - innerWidth <= 1)
 * - Captures screenshot per (viewport, theme)
 * - Writes test-results/compliance-smoke/result.json consumed by compliance
 *   engine (layout-overflow, responsive-design gates).
 *
 * Usage: npx tsx scripts/compliance-smoke.ts
 * Requires dev server already running on http://127.0.0.1:5180
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:5180';
const OUT = resolve('test-results', 'compliance-smoke');
mkdirSync(OUT, { recursive: true });

type Theme = 'light' | 'dark';

type ViewportResult = {
  name: string;
  width: number;
  height: number;
  theme: Theme;
  docOverflow: number;
  bodyOverflow: number;
  consoleErrors: number;
  passed: boolean;
};

const viewports = [
  { name: 'mobile-390', width: 390, height: 800 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

const themes: Theme[] = ['light', 'dark'];

const browser = await chromium.launch();
let allOk = true;
const results: ViewportResult[] = [];

for (const vp of viewports) {
  for (const theme of themes) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: theme,
    });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`));

    await page.goto(URL, { waitUntil: 'networkidle' });
    // Vapor ThemeProvider 가 prefers-color-scheme 을 따르도록 강제: data-theme 속성 직접 설정.
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t);
    }, theme);
    // 토큰 재계산 대기 (Vapor 가 next frame 에 CSS variables 갱신)
    await page.waitForTimeout(150);
    await page.waitForSelector('text=Vapor UI Compliance Workbench', { timeout: 8000 });

    const overflow = await page.evaluate(() => ({
      docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      bodyOverflow: document.body.scrollWidth - window.innerWidth,
    }));

    const label = `${vp.name}-${theme}`;
    const shot = resolve(OUT, `${label}.png`);
    await page.screenshot({ path: shot, fullPage: false });

    const okOverflow = overflow.docOverflow <= 1 && overflow.bodyOverflow <= 1;
    const okErrors = errors.length === 0;
    const status = okOverflow && okErrors ? 'PASS' : 'FAIL';
    if (status !== 'PASS') allOk = false;

    results.push({
      name: vp.name,
      width: vp.width,
      height: vp.height,
      theme,
      docOverflow: overflow.docOverflow,
      bodyOverflow: overflow.bodyOverflow,
      consoleErrors: errors.length,
      passed: status === 'PASS',
    });

    console.log(
      `[${label}] ${status} doc=${overflow.docOverflow} body=${overflow.bodyOverflow} errors=${errors.length}`,
    );
    if (errors.length) errors.forEach((e) => console.log(`  console.error: ${e}`));
    console.log(`  -> ${shot}`);
    await ctx.close();
  }
}

await browser.close();

const resultJson = resolve(OUT, 'result.json');
writeFileSync(
  resultJson,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      url: URL,
      anyOverflow: results.some((r) => r.docOverflow > 1 || r.bodyOverflow > 1),
      testedBreakpoints: Array.from(new Set(results.map((r) => r.name))),
      testedThemes: themes,
      viewports: results,
    },
    null,
    2,
  ),
);
console.log(`-> ${resultJson}`);

process.exit(allOk ? 0 : 1);
