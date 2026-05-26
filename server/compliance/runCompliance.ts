import { resolve } from 'node:path';
import { collectFileSignals } from './collectFileSignals.ts';
import { createComplianceReport } from './createComplianceReport.ts';

/**
 * Node-runnable entry point for the compliance engine.
 * Outputs a JSON ComplianceReport to stdout.
 *
 * Usage:
 *   npx tsx server/compliance/runCompliance.ts [project-root]
 *
 * Defaults to process.cwd() if no project root is provided.
 */
const projectRoot = resolve(process.argv[2] ?? process.cwd());

const signals = collectFileSignals(projectRoot);
const report = createComplianceReport(signals);

process.stdout.write(JSON.stringify(report, null, 2) + '\n');
