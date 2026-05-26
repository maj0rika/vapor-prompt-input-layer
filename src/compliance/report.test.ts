import { describe, expect, it } from 'vitest';
import { aggregateGates, computeOverallScore } from './report.ts';
import type { Gate } from './types.ts';

const passGate: Gate = {
  gateId: 'b-gate',
  name: 'B Gate',
  status: 'PASS',
  evidence: [{ message: 'All good.' }],
  fixGuide: [],
};

const warnGate: Gate = {
  gateId: 'a-gate',
  name: 'A Gate',
  status: 'WARN',
  evidence: [{ message: 'Minor issue.' }],
  fixGuide: [{ title: 'Fix it', detail: 'Do X.' }],
};

const failGate: Gate = {
  gateId: 'c-gate',
  name: 'C Gate',
  status: 'FAIL',
  evidence: [{ message: 'Critical failure.' }],
  fixGuide: [{ title: 'Fix critical', detail: 'Do Y.' }],
};

describe('computeOverallScore', () => {
  it('returns 100 for empty gates', () => {
    expect(computeOverallScore([])).toBe(100);
  });

  it('all PASS → 100', () => {
    expect(computeOverallScore([passGate, passGate])).toBe(100);
  });

  it('all FAIL → 0', () => {
    expect(computeOverallScore([failGate, failGate])).toBe(0);
  });

  it('all WARN → 50', () => {
    expect(computeOverallScore([warnGate, warnGate])).toBe(50);
  });

  it('2 PASS + 1 FAIL → 67', () => {
    expect(computeOverallScore([passGate, passGate, failGate])).toBe(67);
  });

  it('1 PASS + 1 WARN → 75', () => {
    expect(computeOverallScore([passGate, warnGate])).toBe(75);
  });
});

describe('aggregateGates', () => {
  it('sorts gates by gateId for deterministic output', () => {
    const report = aggregateGates([passGate, failGate, warnGate]);
    expect(report.gates.map((g) => g.gateId)).toEqual(['a-gate', 'b-gate', 'c-gate']);
  });

  it('overallStatus is FAIL when any gate FAILs', () => {
    const report = aggregateGates([passGate, failGate, warnGate]);
    expect(report.overallStatus).toBe('FAIL');
  });

  it('overallStatus is WARN when no FAIL but has WARN', () => {
    const report = aggregateGates([passGate, warnGate]);
    expect(report.overallStatus).toBe('WARN');
  });

  it('overallStatus is PASS when all gates PASS', () => {
    const report = aggregateGates([passGate, { ...passGate, gateId: 'x-gate' }]);
    expect(report.overallStatus).toBe('PASS');
  });

  it('golden snapshot — shape is stable', () => {
    const report = aggregateGates([warnGate, passGate]);
    // Strip generatedAt for deterministic snapshot
    const { generatedAt: _, ...rest } = report;
    void _;
    expect(rest).toMatchInlineSnapshot(`
      {
        "gates": [
          {
            "evidence": [
              {
                "message": "Minor issue.",
              },
            ],
            "fixGuide": [
              {
                "detail": "Do X.",
                "title": "Fix it",
              },
            ],
            "gateId": "a-gate",
            "name": "A Gate",
            "status": "WARN",
          },
          {
            "evidence": [
              {
                "message": "All good.",
              },
            ],
            "fixGuide": [],
            "gateId": "b-gate",
            "name": "B Gate",
            "status": "PASS",
          },
        ],
        "overallScore": 75,
        "overallStatus": "WARN",
      }
    `);
  });
});
