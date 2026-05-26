export type GateStatus = 'PASS' | 'WARN' | 'FAIL';

export type Evidence = {
  /** Human-readable description of the finding */
  message: string;
  /** Optional source file path + line reference */
  location?: string;
};

export type FixGuide = {
  /** Short title of the suggested fix */
  title: string;
  /** Detailed description of how to resolve the issue */
  detail: string;
};

export type Gate = {
  /** Stable identifier, e.g. 'vapor-components' */
  gateId: string;
  /** Human-readable name */
  name: string;
  status: GateStatus;
  evidence: Evidence[];
  fixGuide: FixGuide[];
};

export type ComplianceReport = {
  /** ISO 8601 timestamp of when the report was generated */
  generatedAt: string;
  /** 0–100 overall score */
  overallScore: number;
  /** Rolled-up status (FAIL if any gate FAILs, WARN if any gate WARNs, else PASS) */
  overallStatus: GateStatus;
  gates: Gate[];
};
