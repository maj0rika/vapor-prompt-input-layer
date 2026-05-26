import { useState } from 'react';
import { Badge, Button, Text } from '@vapor-ui/core';

export type RemoteValidationDetail = {
  label: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  durationMs?: number;
  output?: string;
};

export type RemoteValidationResult = {
  status: 'pass' | 'warn' | 'fail';
  durationMs: number;
  details: RemoteValidationDetail[];
};

export type ValidationPanelProps = {
  result: RemoteValidationResult | undefined;
  status: 'idle' | 'running' | 'error';
  errorMessage?: string;
  runAt?: number;
  onCopyOutput?: (label: string) => void;
  onRepairGate?: (gate: string) => void;
};

const OUTPUT_LIMIT = 4096;

/** Gate label → 안정적 selector slug. 예: "Runtime Render" → "runtime-render". */
function gateSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Runner message 에서 "across N ... variants (A, B)" 패턴을 affected variants 로 추출. */
function extractAffectedVariants(message: string): string[] {
  const match = message.match(/variants?\s*\(([^)]+)\)/i);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * Gate card 단위 구조화 ValidationPanel.
 *
 * Validation 탭 활성 시 markdown 대신 이 컴포넌트를 렌더링한다.
 */
export function ValidationPanel({
  result,
  status,
  errorMessage,
  runAt,
  onCopyOutput,
  onRepairGate,
}: ValidationPanelProps) {
  if (status === 'running') {
    return (
      <div className="flex flex-col gap-v-200 p-v-200">
        <Text typography="body3" foreground="hint-200">
          검증 실행 중...
        </Text>
      </div>
    );
  }

  if (status === 'error' && !result) {
    return (
      <div className="flex flex-col gap-v-200 p-v-200">
        <Badge size="sm" colorPalette="danger">
          오류
        </Badge>
        <Text typography="body3" foreground="hint-200">
          {errorMessage ?? '검증 요청 중 오류가 발생했습니다.'}
        </Text>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col gap-v-200 p-v-200">
        <Text typography="body3" foreground="hint-200">
          검증 결과가 없습니다. "검증 실행" 버튼을 눌러 시작하세요.
        </Text>
      </div>
    );
  }

  const passCount = result.details.filter((d) => d.status === 'pass').length;
  const failCount = result.details.filter((d) => d.status === 'fail').length;
  const warnCount = result.details.filter((d) => d.status === 'warn').length;
  const totalCount = result.details.length;
  const summary = `${totalCount} gates · ${passCount} pass · ${failCount} fail${warnCount > 0 ? ` · ${warnCount} warn` : ''}`;

  const overallColorPalette =
    result.status === 'pass' ? 'success' : result.status === 'fail' ? 'danger' : 'warning';
  const overallLabel =
    result.status === 'pass' ? 'Pass' : result.status === 'fail' ? 'Fail' : 'Warn';

  const timestamp = runAt
    ? new Date(runAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : undefined;

  return (
    <div className="flex flex-col gap-v-200">
      {/* Header summary */}
      <div className="flex flex-wrap items-center gap-v-100 border-b border-v-normal pb-v-150">
        <Badge size="sm" colorPalette={overallColorPalette} aria-label={`전체 상태: ${overallLabel}`}>
          {overallLabel}
        </Badge>
        <Text typography="body4" foreground="hint-200">
          {summary}
        </Text>
        {result.durationMs > 0 && (
          <Text typography="body4" foreground="hint-200">
            {result.durationMs}ms
          </Text>
        )}
        {timestamp && (
          <Text typography="body4" foreground="hint-200">
            {timestamp}
          </Text>
        )}
      </div>

      {/* 사용자 가치 한 줄 — 게이트 통과/실패가 사용자에게 어떤 의미인지. */}
      <div className="rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-200 py-v-150">
        <Text
          typography="body3"
          foreground={
            result.status === 'pass'
              ? 'success-200'
              : result.status === 'fail'
                ? 'danger-200'
                : 'warning-200'
          }
        >
          {result.status === 'pass'
            ? '모든 게이트 통과 — 이 artifact 는 빌드 / 단위 / 런타임 / 접근성 / 토큰 / 정리 검사를 모두 거쳤습니다. 그대로 사용해도 안전.'
            : result.status === 'fail'
              ? '실패한 게이트가 있습니다 — 아래 카드에서 출력을 확인하고 "Fix with Agent" 로 자동 보수 요청을 보낼 수 있어요.'
              : '경고가 있습니다 — 빌드는 통과하지만 토큰·접근성 등 규칙 일부를 어겼습니다. 검토 권장.'}
        </Text>
      </div>

      {/* Summary list: each item is "Label: STATUS" for E2E selector compatibility */}
      <ul className="flex flex-col gap-v-50">
        {result.details.map((detail) => {
          const statusLabel =
            detail.status === 'pass' ? 'PASS' : detail.status === 'fail' ? 'FAIL' : 'WARN';
          return (
            <li key={detail.label} className="text-sm">
              {detail.label}: {statusLabel}
            </li>
          );
        })}
      </ul>

      {/* Gate card list with detail + disclosure */}
      <ul className="flex flex-col gap-v-150">
        {result.details.map((detail) => (
          <GateCard
            key={detail.label}
            detail={detail}
            onCopyOutput={onCopyOutput}
            onRepairGate={onRepairGate}
          />
        ))}
      </ul>
    </div>
  );
}

function GateCard({
  detail,
  onCopyOutput,
  onRepairGate,
}: {
  detail: RemoteValidationDetail;
  onCopyOutput?: (label: string) => void;
  onRepairGate?: (gate: string) => void;
}) {
  // Failed gates are open by default so E2E can see output without clicking
  const [outputOpen, setOutputOpen] = useState(detail.status === 'fail');

  const statusColorPalette =
    detail.status === 'pass' ? 'success' : detail.status === 'fail' ? 'danger' : 'warning';
  const statusLabel =
    detail.status === 'pass' ? 'PASS' : detail.status === 'fail' ? 'FAIL' : 'WARN';

  const trimmedOutput = detail.output
    ? detail.output.length > OUTPUT_LIMIT
      ? `${detail.output.slice(0, OUTPUT_LIMIT)}\n... 출력이 잘렸습니다 (4KB 상한) ...`
      : detail.output
    : undefined;

  const handleCopyOutput = () => {
    if (trimmedOutput) {
      void navigator.clipboard?.writeText(trimmedOutput);
      onCopyOutput?.(detail.label);
    }
  };

  const slug = gateSlug(detail.label);
  const affectedVariants = extractAffectedVariants(detail.message);

  return (
    <li
      data-testid={`validation-gate-${slug}`}
      data-gate-status={detail.status}
      className="flex flex-col gap-v-100 rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-200 py-v-150"
    >
      {/* Card header: label (left) + duration (right) */}
      <div className="flex items-center justify-between gap-v-100">
        <div className="flex items-center gap-v-100">
          <Badge size="sm" colorPalette={statusColorPalette}>
            {statusLabel}
          </Badge>
          {/* "Label: STATUS" text for E2E listitem selector compatibility */}
          <Text typography="subtitle2">{detail.label}: {statusLabel}</Text>
        </div>
        {detail.durationMs !== undefined && (
          <Text typography="body4" foreground="hint-200">
            {detail.durationMs}ms
          </Text>
        )}
      </div>

      {/* Message */}
      <Text typography="body4">{detail.message}</Text>

      {/* Affected variants (runner message 에서 추출) */}
      {affectedVariants.length > 0 && (
        <Text
          typography="body4"
          foreground="hint-200"
          data-testid={`validation-variants-${slug}`}
        >
          영향받은 variant: {affectedVariants.join(', ')}
        </Text>
      )}

      {/* Output disclosure */}
      {trimmedOutput && (
        <div className="flex flex-col gap-v-100">
          <div className="flex items-center gap-v-50">
            <Button
              size="sm"
              variant="ghost"
              colorPalette="primary"
              aria-expanded={outputOpen}
              onClick={() => setOutputOpen((prev) => !prev)}
            >
              {detail.label} output
            </Button>
            <Button
              size="sm"
              variant="ghost"
              data-testid={`validation-copy-${slug}`}
              onClick={handleCopyOutput}
            >
              출력 복사
            </Button>
          </div>
          {outputOpen && (
            <pre
              className="max-h-64 overflow-y-auto rounded-v-200 border border-v-normal bg-v-canvas-100 p-v-150 font-mono text-xs"
              aria-label={`${detail.label} 출력`}
              data-testid={`validation-output-${slug}`}
            >
              <code>{trimmedOutput}</code>
            </pre>
          )}
        </div>
      )}

      {/* Failed gate repair action */}
      {detail.status === 'fail' && onRepairGate && (
        <Button
          size="sm"
          variant="outline"
          colorPalette="danger"
          data-testid={`validation-repair-${slug}`}
          onClick={() => onRepairGate(detail.label)}
        >
          이 gate 수정
        </Button>
      )}
    </li>
  );
}
