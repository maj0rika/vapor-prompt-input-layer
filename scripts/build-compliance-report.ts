/**
 * Build-time compliance report generator.
 * Runs the deterministic compliance engine and writes the result to
 * public/compliance-report.json so the deployed Vercel site can serve it
 * as a static asset instead of relying on the Vite dev-server middleware.
 *
 * Usage: npx tsx scripts/build-compliance-report.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectFileSignals, GOVERNED_SCAN_PATHS } from '../server/compliance/collectFileSignals.ts';
import { createComplianceReport } from '../server/compliance/createComplianceReport.ts';
import { runEslintJson } from '../server/compliance/runEslint.ts';

const PROJECT_ROOT = process.cwd();
const OUT = resolve(PROJECT_ROOT, 'public', 'compliance-report.json');

console.log('[build-compliance-report] Scanning governed paths...');
const signals = collectFileSignals(PROJECT_ROOT, { scope: 'governed' });

// Run ESLint (available in Vercel build via devDependencies).
let eslintMessages;
try {
  eslintMessages = await runEslintJson(GOVERNED_SCAN_PATHS);
  console.log(`[build-compliance-report] ESLint: ${eslintMessages.length} issues`);
} catch (err) {
  console.warn(
    '[build-compliance-report] ESLint skipped:',
    err instanceof Error ? err.message : err,
  );
}

// Browser smoke requires Playwright + Chromium — not available in Vercel build.
// Gates report WARN with a clear skip message.
const report = createComplianceReport(signals, {
  eslintMessages,
  browserSmoke: undefined,
});

writeFileSync(OUT, JSON.stringify(report), 'utf-8');
console.log(`[build-compliance-report] Wrote ${OUT} (${report.gates.length} gates, ${report.overallStatus})`);
