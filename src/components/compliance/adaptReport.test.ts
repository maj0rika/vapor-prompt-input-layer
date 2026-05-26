import { describe, expect, it } from 'vitest';
import { adaptEngineReport } from './adaptReport';
import type { ComplianceReport as EngineReport } from '../../compliance/types';

function makeEngine(partial: Partial<EngineReport> = {}): EngineReport {
  return {
    generatedAt: '2026-05-26T00:00:00.000Z',
    overallScore: 75,
    overallStatus: 'WARN',
    gates: [
      {
        gateId: 'design-tokens',
        name: 'Design Token Usage',
        status: 'FAIL',
        evidence: [
          { message: 'Found 3 raw hex colors.', location: 'src/foo.tsx' },
          { message: 'Found 1 raw rgb() call.' },
        ],
        fixGuide: [
          { title: 'Replace hex', detail: 'Use Vapor tokens' },
          { title: 'Replace rgb', detail: '' },
        ],
      },
      {
        gateId: 'documentation',
        name: 'Documentation',
        status: 'PASS',
        evidence: [],
        fixGuide: [],
      },
      {
        gateId: 'accessibility',
        name: 'Accessibility (ESLint jsx-a11y)',
        status: 'WARN',
        evidence: [{ message: 'Scan skipped.' }],
        fixGuide: [{ title: 'Run ESLint', detail: 'pass jsx-a11y output' }],
      },
    ],
    ...partial,
  };
}

describe('adaptEngineReport', () => {
  it('maps top-level fields', () => {
    const engine = makeEngine();
    const shell = adaptEngineReport(engine);
    expect(shell.id).toBe('compliance-2026-05-26T00:00:00.000Z');
    expect(shell.timestamp).toBe('2026-05-26T00:00:00.000Z');
    expect(shell.score).toBe(75);
    expect(shell.overallStatus).toBe('WARN');
  });

  it('counts gates by status', () => {
    const shell = adaptEngineReport(makeEngine());
    expect(shell.gateCount).toEqual({ pass: 1, warn: 1, fail: 1 });
  });

  it('renames known gates to Korean labels', () => {
    const shell = adaptEngineReport(makeEngine());
    const tokens = shell.gates.find((g) => g.id === 'design-tokens')!;
    const a11y = shell.gates.find((g) => g.id === 'accessibility')!;
    const docs = shell.gates.find((g) => g.id === 'documentation')!;
    expect(tokens.name).toBe('토큰 & 스타일');
    expect(a11y.name).toBe('접근성');
    expect(docs.name).toBe('문서 준비도');
  });

  it('falls back to engine name when gateId is unknown', () => {
    const engine = makeEngine({
      gates: [
        {
          gateId: 'unknown-gate',
          name: 'Unknown Gate',
          status: 'PASS',
          evidence: [],
          fixGuide: [],
        },
      ],
    });
    const shell = adaptEngineReport(engine);
    expect(shell.gates[0].name).toBe('Unknown Gate');
  });

  it('maps evidence message → snippet, location → file', () => {
    const shell = adaptEngineReport(makeEngine());
    const tokens = shell.gates.find((g) => g.id === 'design-tokens')!;
    expect(tokens.issueCount).toBe(2);
    expect(tokens.evidence[0]).toEqual({
      file: 'src/foo.tsx',
      line: 0,
      snippet: 'Found 3 raw hex colors.',
    });
    expect(tokens.evidence[1]).toEqual({
      file: '',
      line: 0,
      snippet: 'Found 1 raw rgb() call.',
    });
  });

  it('numbers fix guide steps and joins title + detail', () => {
    const shell = adaptEngineReport(makeEngine());
    const tokens = shell.gates.find((g) => g.id === 'design-tokens')!;
    expect(tokens.fixGuide.steps).toEqual([
      { step: 1, description: 'Replace hex — Use Vapor tokens' },
      { step: 2, description: 'Replace rgb' },
    ]);
  });

  it('attaches doc link for known gates', () => {
    const shell = adaptEngineReport(makeEngine());
    const tokens = shell.gates.find((g) => g.id === 'design-tokens')!;
    expect(tokens.fixGuide.docLink).toContain('vapor-ui.goorm.io');
  });
});
