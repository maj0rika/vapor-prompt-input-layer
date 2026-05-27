import type { ComplianceReport } from '../../src/compliance/types.ts';
import type { ESLintMessage } from '../../src/compliance/rules/accessibilityRules.ts';
import { aggregateGates } from '../../src/compliance/report.ts';
import { checkOverflow } from '../../src/compliance/rules/layoutRules.ts';
import { checkVaporComponents } from '../../src/compliance/rules/vaporComponentRules.ts';
import { checkTokens } from '../../src/compliance/rules/tokenRules.ts';
import { checkAccessibility } from '../../src/compliance/rules/accessibilityRules.ts';
import { checkResponsive } from '../../src/compliance/rules/responsiveRules.ts';
import { checkDocumentation } from '../../src/compliance/rules/documentationRules.ts';
import { checkCodeQuality } from '../../src/compliance/rules/codeQualityRules.ts';
import type { FileSignals } from './collectFileSignals.ts';
import type { BrowserSmokeResult } from './readBrowserResults.ts';

export type ReportInputs = {
  /** ESLint jsx-a11y messages, or undefined to skip accessibility gate. */
  eslintMessages?: ESLintMessage[];
  /** Browser smoke result from scripts/compliance-smoke.ts, or undefined to skip layout/responsive gates. */
  browserSmoke?: BrowserSmokeResult;
};

/**
 * Assembles a full ComplianceReport from collected file signals.
 * All gates run deterministically from the same input.
 */
export function createComplianceReport(
  signals: FileSignals,
  inputs: ReportInputs = {},
): ComplianceReport {
  const gates = [
    checkOverflow(
      inputs.browserSmoke
        ? { overflowDetected: inputs.browserSmoke.anyOverflow }
        : {},
    ),
    checkVaporComponents({ fileSources: signals.fileSources }),
    checkTokens({ fileSources: signals.fileSources }),
    checkAccessibility({ eslintMessages: inputs.eslintMessages }),
    checkResponsive(
      inputs.browserSmoke
        ? { testedBreakpoints: inputs.browserSmoke.testedBreakpoints }
        : {},
    ),
    checkDocumentation({
      readmeContent: signals.readmeContent,
      vaporComplianceDocExists: signals.vaporComplianceDocExists,
    }),
    checkCodeQuality({
      tsconfigText: signals.tsconfigText,
      scriptNames: signals.scriptNames,
      readmeLength: signals.readmeContent?.length,
    }),
  ];

  return aggregateGates(gates);
}
