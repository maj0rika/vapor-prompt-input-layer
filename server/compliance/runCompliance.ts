import { resolve } from 'node:path';
import { collectFileSignals, type ScanScope } from './collectFileSignals.ts';
import { createComplianceReport } from './createComplianceReport.ts';

/**
 * Node-runnable entry point for the compliance engine.
 * Outputs a JSON ComplianceReport to stdout.
 *
 * Usage:
 *   npx tsx server/compliance/runCompliance.ts [--governed] [project-root]
 *
 * Flags:
 *   --governed   compliance-governed 경로만 검사 (verify:compliance). 기본 = all.
 *   --fail-on-fail   overallStatus === FAIL 일 때 exit 1 (CI 게이트용).
 */
const args = process.argv.slice(2);
const governed = args.includes('--governed');
const failOnFail = args.includes('--fail-on-fail');
const positional = args.filter((a) => !a.startsWith('--'));
const projectRoot = resolve(positional[0] ?? process.cwd());
const scope: ScanScope = governed ? 'governed' : 'all';

const signals = collectFileSignals(projectRoot, { scope });
const report = createComplianceReport(signals);

process.stdout.write(JSON.stringify(report, null, 2) + '\n');

if (failOnFail && report.overallStatus === 'FAIL') {
  process.stderr.write(
    `\n[compliance] overallStatus=FAIL (scope=${scope}). exit 1.\n`,
  );
  process.exit(1);
}
