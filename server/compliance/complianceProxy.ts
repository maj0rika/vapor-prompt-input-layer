import type { IncomingMessage, ServerResponse } from 'node:http';
import { collectFileSignals } from './collectFileSignals';
import { createComplianceReport } from './createComplianceReport';

/**
 * Vite dev middleware: GET /api/compliance/report → JSON ComplianceReport.
 * Runs the deterministic engine over the project root and returns the result.
 */
export async function handleComplianceReport(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  try {
    const signals = collectFileSignals(process.cwd());
    const report = createComplianceReport(signals);
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(report));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: 'compliance_scan_failed',
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
