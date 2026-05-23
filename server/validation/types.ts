import type { TokenCheckResult } from '../../src/agent/tokenUsage.ts';

export type ValidationStatus = 'pass' | 'warn' | 'fail';

export type ValidationDetail = {
  label: string;
  status: ValidationStatus;
  message: string;
  durationMs?: number;
  output?: string;
};

export type GeneratedValidationResult = {
  status: ValidationStatus;
  durationMs: number;
  details: ValidationDetail[];
  tokenUsage?: TokenCheckResult;
};
