import type { Gate } from '../types.ts';

export type ESLintMessage = {
  ruleId: string | null;
  severity: number;
  message: string;
  line: number;
  column: number;
  filePath?: string;
};

export type AccessibilityInput = {
  /**
   * Normalized ESLint JSON output (from eslint-plugin-jsx-a11y).
   * Pass an empty array to indicate no violations found.
   * Pass undefined to indicate the scan has not been run yet.
   */
  eslintMessages?: ESLintMessage[];
};

/**
 * Normalizes ESLint accessibility output into a compliance Gate.
 * Does not execute ESLint itself — accepts pre-parsed JSON input.
 */
export function checkAccessibility(input: AccessibilityInput = {}): Gate {
  const gateId = 'accessibility';
  const name = 'Accessibility (ESLint jsx-a11y)';

  if (input.eslintMessages === undefined) {
    return {
      gateId,
      name,
      status: 'WARN',
      evidence: [
        {
          message: 'Accessibility scan skipped: no ESLint output provided.',
        },
      ],
      fixGuide: [
        {
          title: 'Run ESLint with jsx-a11y',
          detail:
            'Run `eslint --format json src/` and pass the parsed messages array to enable this gate.',
        },
      ],
    };
  }

  const a11yMessages = input.eslintMessages.filter(
    (msg) => msg.ruleId?.startsWith('jsx-a11y/') ?? false,
  );

  const errors = a11yMessages.filter((m) => m.severity === 2);
  const warnings = a11yMessages.filter((m) => m.severity === 1);

  const evidence = [];
  const fixGuide = [];

  if (errors.length > 0) {
    for (const err of errors) {
      evidence.push({
        message: `[ERROR] ${err.ruleId}: ${err.message}`,
        location: err.filePath ? `${err.filePath}:${err.line}:${err.column}` : undefined,
      });
    }
    fixGuide.push({
      title: 'Fix jsx-a11y errors',
      detail: `Resolve ${errors.length} accessibility error(s) reported by eslint-plugin-jsx-a11y.`,
    });
  }

  if (warnings.length > 0) {
    for (const warn of warnings) {
      evidence.push({
        message: `[WARN] ${warn.ruleId}: ${warn.message}`,
        location: warn.filePath ? `${warn.filePath}:${warn.line}:${warn.column}` : undefined,
      });
    }
    fixGuide.push({
      title: 'Address jsx-a11y warnings',
      detail: `Review ${warnings.length} accessibility warning(s) reported by eslint-plugin-jsx-a11y.`,
    });
  }

  if (errors.length === 0 && warnings.length === 0) {
    evidence.push({ message: 'No jsx-a11y violations found.' });
  }

  const status = errors.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS';

  return {
    gateId,
    name,
    status,
    evidence,
    fixGuide,
  };
}
