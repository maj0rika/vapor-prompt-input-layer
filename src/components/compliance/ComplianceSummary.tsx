import { Badge, Text } from '@vapor-ui/core';
import type { ComplianceReport, GateStatus } from './mockReport';

interface ComplianceSummaryProps {
  report: ComplianceReport;
}

const STATUS_LABEL: Record<GateStatus, string> = {
  PASS: '통과',
  WARN: '경고',
  FAIL: '실패',
};

const STATUS_PALETTE: Record<GateStatus, 'success' | 'warning' | 'danger'> = {
  PASS: 'success',
  WARN: 'warning',
  FAIL: 'danger',
};

/**
 * 종합 PASS/WARN/FAIL 배지 + 점수 + gate 집계를 표시한다.
 */
export function ComplianceSummary({ report }: ComplianceSummaryProps) {
  const { overallStatus, score, gateCount } = report;

  return (
    <div
      className="flex flex-col gap-v-200 rounded-v-300 border border-v-normal bg-v-canvas-100 p-v-300"
      data-testid="compliance-summary"
    >
      {/* 종합 상태 */}
      <div className="flex items-center justify-between">
        <Text typography="subtitle2">종합 결과</Text>
        <Badge
          colorPalette={STATUS_PALETTE[overallStatus]}
          shape="pill"
          size="md"
          aria-label={`종합 결과: ${STATUS_LABEL[overallStatus]}`}
        >
          {STATUS_LABEL[overallStatus]}
        </Badge>
      </div>

      {/* 점수 바 */}
      <div className="flex flex-col gap-v-75">
        <div className="flex items-baseline justify-between">
          <Text typography="body4" foreground="hint-200">준수 점수</Text>
          <Text typography="subtitle1">{score}점</Text>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-v-100 bg-v-canvas-200"
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`준수 점수 ${score}점`}
        >
          <div
            className={[
              'h-full rounded-v-100 transition-all',
              score >= 80
                ? 'bg-green-500'
                : score >= 50
                  ? 'bg-yellow-500'
                  : 'bg-red-500',
            ].join(' ')}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Gate 집계 */}
      <div className="grid grid-cols-3 gap-v-100">
        <StatChip label="통과" value={gateCount.pass} palette="success" />
        <StatChip label="경고" value={gateCount.warn} palette="warning" />
        <StatChip label="실패" value={gateCount.fail} palette="danger" />
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  palette,
}: {
  label: string;
  value: number;
  palette: 'success' | 'warning' | 'danger';
}) {
  const textClass =
    palette === 'success'
      ? 'text-green-700'
      : palette === 'warning'
        ? 'text-yellow-700'
        : 'text-red-700';

  const bgClass =
    palette === 'success'
      ? 'bg-green-100'
      : palette === 'warning'
        ? 'bg-yellow-100'
        : 'bg-red-100';

  return (
    <div
      className={`flex flex-col items-center rounded-v-200 py-v-100 ${bgClass}`}
    >
      <span className={`text-lg font-bold leading-none ${textClass}`}>{value}</span>
      <Text typography="body4" foreground="hint-200">{label}</Text>
    </div>
  );
}
