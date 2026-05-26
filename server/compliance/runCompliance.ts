import { resolve } from 'node:path';
import { collectFileSignals, GOVERNED_SCAN_PATHS, type ScanScope } from './collectFileSignals.ts';
import { createComplianceReport } from './createComplianceReport.ts';
import { runEslintJson } from './runEslint.ts';
import { readBrowserSmokeResult } from './readBrowserResults.ts';

/**
 * Node-runnable entry point for the compliance engine.
 * Outputs a JSON ComplianceReport to stdout.
 *
 * Usage:
 *   npx tsx server/compliance/runCompliance.ts [--governed] [project-root]
 *
 * Flags:
 *   --governed   compliance-governed 경로만 검사 (verify:compliance). 기본 = all.
 *   --fail-on-fail   overallStatus === FAIL 일 때 exit 1.
 *   --fail-on-warn   overallStatus !== PASS 일 때 exit 1 (strict mode).
 */
const args = process.argv.slice(2);
const governed = args.includes('--governed');
const failOnFail = args.includes('--fail-on-fail');
const failOnWarn = args.includes('--fail-on-warn');
const strict = failOnWarn;
const positional = args.filter((a) => !a.startsWith('--'));
const projectRoot = resolve(positional[0] ?? process.cwd());
const scope: ScanScope = governed ? 'governed' : 'all';

const signals = collectFileSignals(projectRoot, { scope });

let eslintMessages;
try {
  const paths = scope === 'governed' ? GOVERNED_SCAN_PATHS : ['src/'];
  eslintMessages = await runEslintJson(paths);
} catch (err) {
  process.stderr.write(
    `[compliance] ESLint scan failed: ${err instanceof Error ? err.message : err}\n`,
  );
}

const browserSmoke = readBrowserSmokeResult(projectRoot);
const report = createComplianceReport(signals, { eslintMessages, browserSmoke });

process.stdout.write(JSON.stringify(report, null, 2) + '\n');

if (failOnWarn && report.overallStatus === 'WARN') {
  process.stderr.write(
    `\n[compliance] overallStatus=WARN (scope=${scope}, strict mode). exit 1.\n`,
  );
  process.exit(1);
}
if (failOnFail && report.overallStatus === 'FAIL') {
  process.stderr.write(
    `\n[compliance] overallStatus=FAIL (scope=${scope}). exit 1.\n`,
  );
  process.exit(1);
}
