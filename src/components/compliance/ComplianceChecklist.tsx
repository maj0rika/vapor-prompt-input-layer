import { Badge, Text } from '@vapor-ui/core';
import type { ComplianceGate, GateStatus } from './mockReport';

interface ComplianceChecklistProps {
  gates: ComplianceGate[];
  selectedGateId: string | null;
  onSelectGate: (id: string) => void;
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
 * 왼쪽 사이드바: 7개 Gate 목록 + 상태 배지.
 * 항목 클릭 시 오른쪽 패널에 해당 Gate 상세를 표시한다.
 */
export function ComplianceChecklist({
  gates,
  selectedGateId,
  onSelectGate,
}: ComplianceChecklistProps) {
  return (
    <nav
      aria-label="컴플라이언스 게이트 목록"
      className="flex flex-col gap-v-50 rounded-v-300 border border-v-normal bg-v-canvas-100 p-v-200"
    >
      <div className="px-v-100 pb-v-100">
        <Text typography="subtitle2" foreground="hint-100">
          검사 게이트
        </Text>
      </div>
      <ul className="flex flex-col gap-v-25" role="listbox" aria-label="게이트 선택">
        {gates.map((gate) => {
          const isSelected = gate.id === selectedGateId;
          return (
            <li key={gate.id} role="option" aria-selected={isSelected}>
              <button
                type="button"
                onClick={() => onSelectGate(gate.id)}
                aria-label={`${gate.name} — ${STATUS_LABEL[gate.status]}${gate.issueCount > 0 ? `, 이슈 ${gate.issueCount}건` : ''}`}
                className={[
                  'flex w-full items-center justify-between rounded-v-200 px-v-150 py-v-100 text-left transition-colors',
                  isSelected
                    ? 'bg-v-primary-100'
                    : 'hover:bg-v-canvas-200',
                ].join(' ')}
              >
                <div className="flex min-w-0 flex-col gap-v-25">
                  <Text
                    typography="body3"
                    foreground={isSelected ? 'primary-200' : 'normal-100'}
                  >
                    {gate.name}
                  </Text>
                  {gate.issueCount > 0 && (
                    <Text typography="body4" foreground="hint-200">
                      이슈 {gate.issueCount}건
                    </Text>
                  )}
                </div>
                <Badge
                  colorPalette={STATUS_PALETTE[gate.status]}
                  shape="pill"
                  size="sm"
                >
                  {STATUS_LABEL[gate.status]}
                </Badge>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
