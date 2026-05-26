import { useCallback, useEffect, useState } from 'react';
import { Text } from '@vapor-ui/core';
import { ComplianceHeader } from '../components/compliance/ComplianceHeader';
import { ComplianceChecklist } from '../components/compliance/ComplianceChecklist';
import { ComplianceSummary } from '../components/compliance/ComplianceSummary';
import { ComplianceGateCard } from '../components/compliance/ComplianceGateCard';
import { MOCK_REPORT, type ComplianceReport } from '../components/compliance/mockReport';
import { adaptEngineReport } from '../components/compliance/adaptReport';
import type { ComplianceReport as EngineReport } from '../compliance/types';

/**
 * Vapor UI Compliance Workbench 최상위 페이지.
 *
 * /api/compliance/report (Vite 미들웨어, server/compliance/complianceProxy) 에서
 * 실제 엔진 결과를 fetch 한다. 엔진은 deterministic 한 스캐너 집합.
 * 네트워크 실패·CSR-only 환경에서는 MOCK_REPORT 로 graceful fallback.
 */
export function CompliancePage() {
  const [report, setReport] = useState<ComplianceReport>(MOCK_REPORT);
  const [selectedGateId, setSelectedGateId] = useState<string>(
    MOCK_REPORT.gates[0]?.id ?? '',
  );
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/compliance/report', {
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const engineReport = (await res.json()) as EngineReport;
      const adapted = adaptEngineReport(engineReport);
      setReport(adapted);
      setSelectedGateId(adapted.gates[0]?.id ?? '');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`엔진 호출 실패 (${msg}). 모크 리포트로 표시합니다.`);
      setReport(MOCK_REPORT);
      setSelectedGateId(MOCK_REPORT.gates[0]?.id ?? '');
    } finally {
      setIsRunning(false);
    }
  }, []);

  useEffect(() => {
    void runScan();
  }, [runScan]);

  const handleReset = () => {
    setReport(MOCK_REPORT);
    setSelectedGateId(MOCK_REPORT.gates[0]?.id ?? '');
    setError(null);
  };

  const selectedGate =
    report.gates.find((g) => g.id === selectedGateId) ?? report.gates[0];

  return (
    <div className="flex min-h-screen flex-col bg-v-canvas-200">
      <ComplianceHeader
        onRun={() => void runScan()}
        onReset={handleReset}
        isRunning={isRunning}
      />

      <div className="px-v-400 py-v-150">
        <Text typography="body4" foreground="hint-200">
          마지막 검사:{' '}
          {new Date(report.timestamp).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </div>

      {error && (
        <div
          role="status"
          className="mx-v-400 mb-v-200 rounded-v-200 border border-v-warning-200 bg-v-warning-100 px-v-300 py-v-200"
        >
          <Text typography="body4" foreground="warning-300">
            {error}
          </Text>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-v-300 px-v-400 pb-v-400 md:flex-row md:items-start">
        <aside className="flex w-full flex-col gap-v-200 md:w-72 md:shrink-0">
          <ComplianceSummary report={report} />
          <ComplianceChecklist
            gates={report.gates}
            selectedGateId={selectedGateId}
            onSelectGate={setSelectedGateId}
          />
        </aside>

        <main className="min-w-0 flex-1">
          {selectedGate ? (
            <ComplianceGateCard gate={selectedGate} />
          ) : (
            <div className="flex items-center justify-center py-v-400">
              <Text typography="body3" foreground="hint-200">
                게이트를 선택하세요.
              </Text>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
