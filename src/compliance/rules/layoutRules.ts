import type { Gate } from '../types.ts';

export type LayoutCheckInput = {
  /** Optional Playwright screenshot result: true = no overflow detected */
  overflowDetected?: boolean;
};

/**
 * Checks for layout overflow issues.
 * If no Playwright result is provided, the gate is skipped (WARN + skipped evidence).
 */
export function checkOverflow(input: LayoutCheckInput = {}): Gate {
  const gateId = 'layout-overflow';
  const name = 'Layout Overflow';

  if (input.overflowDetected === undefined) {
    return {
      gateId,
      name,
      status: 'WARN',
      evidence: [
        {
          message: 'Layout overflow check skipped: no Playwright result provided.',
        },
      ],
      fixGuide: [
        {
          title: 'Wire Playwright screenshot',
          detail:
            'Run Playwright layout spec and pass overflowDetected result to enable this gate.',
        },
      ],
    };
  }

  if (input.overflowDetected) {
    return {
      gateId,
      name,
      status: 'FAIL',
      evidence: [
        {
          message: 'Playwright detected layout overflow in one or more breakpoints.',
        },
      ],
      fixGuide: [
        {
          title: 'Fix overflow',
          detail: 'Inspect elements with overflow: hidden/scroll and constrain widths using Vapor tokens.',
        },
      ],
    };
  }

  return {
    gateId,
    name,
    status: 'PASS',
    evidence: [{ message: 'No layout overflow detected.' }],
    fixGuide: [],
  };
}
