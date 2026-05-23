import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { runCommand } from './runCommand.ts';

const PORT = 4173;
const URL = `http://127.0.0.1:${PORT}`;
const reportDir = await mkdtemp(join(tmpdir(), 'vapor-lighthouse-'));
const reportPath = join(reportDir, 'report.json');
const viteBin = resolve('node_modules/.bin/vite');
const lighthouseBin = resolve('node_modules/.bin/lighthouse');

const preview = spawn(
  viteBin,
  ['preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);

try {
  await waitForServer(URL);
  const result = await runCommand(
    lighthouseBin,
    [
      URL,
      '--preset=desktop',
      '--only-categories=performance,accessibility,best-practices,seo',
      '--chrome-flags=--headless=new --no-sandbox',
      '--output=json',
      `--output-path=${reportPath}`,
      '--quiet',
    ],
    process.cwd(),
    60_000,
  );

  if (result.exitCode !== 0) {
    console.error(result.output);
    process.exit(1);
  }

  const report = JSON.parse(await readFile(reportPath, 'utf8')) as LighthouseReport;
  const checks = [
    score('Performance', report.categories.performance.score, 0.9),
    score('Accessibility', report.categories.accessibility.score, 0.95),
    score('Best Practices', report.categories['best-practices'].score, 0.95),
    score('SEO', report.categories.seo.score, 0.9),
    metric('LCP', report.audits['largest-contentful-paint'].numericValue, 2500),
    metric('CLS', report.audits['cumulative-layout-shift'].numericValue, 0.1),
  ];

  for (const check of checks) {
    console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}: ${check.value}`);
  }

  if (checks.some((check) => !check.pass)) {
    process.exit(1);
  }
} finally {
  preview.kill('SIGTERM');
  await rm(reportDir, { recursive: true, force: true });
}

type LighthouseReport = {
  categories: Record<string, { score: number }>;
  audits: Record<string, { numericValue: number }>;
};

function score(label: string, actual: number, minimum: number) {
  const percent = Math.round(actual * 100);
  return {
    label,
    value: `${percent} >= ${Math.round(minimum * 100)}`,
    pass: actual >= minimum,
  };
}

function metric(label: string, actual: number, maximum: number) {
  return {
    label,
    value: `${Math.round(actual)} <= ${maximum}`,
    pass: actual <= maximum,
  };
}

async function waitForServer(url: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15_000) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Preview server did not become ready: ${url}`);
}
