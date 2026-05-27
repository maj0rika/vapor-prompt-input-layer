import { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from '@vapor-ui/core';
import { ComplianceHeader } from '../components/compliance/ComplianceHeader';
import { ComplianceChecklist } from '../components/compliance/ComplianceChecklist';
import { ComplianceSummary } from '../components/compliance/ComplianceSummary';
import { ComplianceGateCard } from '../components/compliance/ComplianceGateCard';
import type { ComplianceReport } from '../components/compliance/mockReport';
import { adaptEngineReport } from '../components/compliance/adaptReport';
import type { ComplianceReport as EngineReport } from '../compliance/types';

/**
 * Vapor UI Compliance Workbench 최상위 페이지.
 *
 * /api/compliance/report (Vite 미들웨어, server/compliance/complianceProxy) 에서
 * 실제 엔진 결과를 fetch 한다. 엔진은 deterministic 한 스캐너 집합.
 * Vercel production 환경에서는 빌드 시 생성된 정적 JSON 이 반환된다.
 * 네트워크 실패·CSR-only 환경에서는 Engine Failure 에러를 표시한다.
 */
export function CompliancePage() {
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [selectedGateId, setSelectedGateId] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  // 최소 600ms 동안 로딩 상태를 유지해 사용자가 피드백을 인지할 수 있게 함
  const runScan = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    setIsRunning(true);
    setError(null);
    const start = Date.now();
    try {
      const res = await fetch('/api/compliance/report', {
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const engineReport = (await res.json()) as EngineReport;
      // 최소 로딩 시간 보장
      const elapsed = Date.now() - start;
      if (elapsed < 600) await new Promise((r) => setTimeout(r, 600 - elapsed));
      // fetch 경합 방지: 최신 요청만 반영
      if (fetchId !== fetchIdRef.current) return;
      const adapted = adaptEngineReport(engineReport);
      setReport(adapted);
      setSelectedGateId(adapted.gates[0]?.id ?? '');
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Engine Failure: ${msg}`);
    } finally {
      if (fetchId === fetchIdRef.current) setIsRunning(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runScan();
  }, [runScan]);

  const handleReset = () => {
    // Cancel any in-flight fetch by advancing the fetch ID
    fetchIdRef.current += 1;
    setReport(null);
    setSelectedGateId('');
    setError(null);
    setIsRunning(false);
  };

  const selectedGate = report
    ? (report.gates.find((g) => g.id === selectedGateId) ?? report.gates[0] ?? null)
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-v-canvas-200">
      <ComplianceHeader
        onRun={() => void runScan()}
        onReset={handleReset}
        isRunning={isRunning}
      />

      {report && (
        <div className="flex items-center gap-v-100 px-v-400 py-v-150">
          <Text typography="body4" foreground="hint-200">
            마지막 검사:{' '}
            {new Date(report.timestamp).toLocaleString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </Text>
          <span className="rounded-v-100 bg-v-canvas-300 px-v-100 py-v-25 text-xs text-v-hint">
            빌드 시 생성
          </span>
        </div>
      )}

      {error && (
        <div
          role="status"
          data-testid="compliance-engine-error"
          className="mx-v-400 mb-v-200 rounded-v-200 border border-v-warning-200 bg-v-warning-100 px-v-300 py-v-200"
        >
          <Text typography="body4" foreground="warning-100">
            {error}
          </Text>
        </div>
      )}

      {isRunning && !report && !error && (
        <div className="flex flex-1 items-center justify-center px-v-400 pb-v-400">
          <Text typography="body3" foreground="hint-200">
            컴플라이언스 검사 실행 중…
          </Text>
        </div>
      )}

      {report ? (
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
      ) : !isRunning ? (
        <div className="flex flex-1 items-center justify-center px-v-400 pb-v-400">
          <Text typography="body3" foreground="hint-200">
            검사를 실행하세요.
          </Text>
        </div>
      ) : null}
    </div>
  );
}
