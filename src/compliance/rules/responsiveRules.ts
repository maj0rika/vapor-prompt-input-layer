import type { Gate } from '../types.ts';

export type ResponsiveInput = {
  /**
   * Optional list of breakpoints that were tested.
   * Pass undefined to indicate the scan has not been run yet.
   */
  testedBreakpoints?: string[];
};

/**
 * Placeholder gate for responsive design checks.
 * Returns WARN until Playwright responsive scan is wired up.
 */
export function checkResponsive(input: ResponsiveInput = {}): Gate {
  const gateId = 'responsive-design';
  const name = 'Responsive Design';

  if (input.testedBreakpoints === undefined) {
    return {
      gateId,
      name,
      status: 'WARN',
      evidence: [
        {
          message: 'Responsive design check skipped: no breakpoint test results provided.',
        },
      ],
      fixGuide: [
        {
          title: 'Wire responsive Playwright spec',
          detail:
            'Run Playwright tests at mobile/tablet/desktop breakpoints and pass testedBreakpoints to enable this gate.',
        },
      ],
    };
  }

  const evidence = [
    {
      message: `Responsive tests completed for breakpoints: ${input.testedBreakpoints.join(', ')}.`,
    },
  ];

  return {
    gateId,
    name,
    status: 'PASS',
    evidence,
    fixGuide: [],
  };
}
