import type { ComplianceReport, Gate, GateStatus } from './types.ts';

/**
 * Aggregates gates into a ComplianceReport.
 * Gates are sorted by gateId for deterministic output.
 */
export function aggregateGates(gates: Gate[]): ComplianceReport {
  const sorted = [...gates].sort((a, b) => a.gateId.localeCompare(b.gateId));
  const overallStatus = computeOverallStatus(sorted);
  const overallScore = computeOverallScore(sorted);
  return {
    generatedAt: new Date().toISOString(),
    overallScore,
    overallStatus,
    gates: sorted,
  };
}

/**
 * Computes 0–100 score: each PASS gate = full weight, WARN = half, FAIL = 0.
 * Returns 100 when there are no gates.
 */
export function computeOverallScore(gates: Gate[]): number {
  if (gates.length === 0) return 100;
  const total = gates.length;
  const points = gates.reduce((acc, gate) => {
    if (gate.status === 'PASS') return acc + 1;
    if (gate.status === 'WARN') return acc + 0.5;
    return acc;
  }, 0);
  return Math.round((points / total) * 100);
}

function computeOverallStatus(gates: Gate[]): GateStatus {
  if (gates.some((g) => g.status === 'FAIL')) return 'FAIL';
  if (gates.some((g) => g.status === 'WARN')) return 'WARN';
  return 'PASS';
}
