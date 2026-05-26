import type { ComplianceReport } from '../../src/compliance/types.ts';
import { aggregateGates } from '../../src/compliance/report.ts';
import { checkOverflow } from '../../src/compliance/rules/layoutRules.ts';
import { checkVaporComponents } from '../../src/compliance/rules/vaporComponentRules.ts';
import { checkTokens } from '../../src/compliance/rules/tokenRules.ts';
import { checkAccessibility } from '../../src/compliance/rules/accessibilityRules.ts';
import { checkResponsive } from '../../src/compliance/rules/responsiveRules.ts';
import { checkDocumentation } from '../../src/compliance/rules/documentationRules.ts';
import type { FileSignals } from './collectFileSignals.ts';

/**
 * Assembles a full ComplianceReport from collected file signals.
 * All gates run deterministically from the same input.
 */
export function createComplianceReport(signals: FileSignals): ComplianceReport {
  const gates = [
    checkOverflow({}),
    checkVaporComponents({ source: signals.combinedSource }),
    checkTokens({ source: signals.combinedSource }),
    checkAccessibility({}),
    checkResponsive({}),
    checkDocumentation({
      readmeContent: signals.readmeContent,
      vaporComplianceDocExists: signals.vaporComplianceDocExists,
    }),
  ];

  return aggregateGates(gates);
}
