import { useState } from 'react';
import { Badge, Card, Tabs, Text } from '@vapor-ui/core';
import type { ComplianceGate, GateStatus } from './mockReport';
import { EvidencePanel } from './EvidencePanel';
import { FixGuidePanel } from './FixGuidePanel';

interface ComplianceGateCardProps {
  gate: ComplianceGate;
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
 * 선택된 Gate 상세 카드.
 * 상태 배지 + 이슈 수 헤더, 그리고 증거/수정가이드 탭을 포함한다.
 */
export function ComplianceGateCard({ gate }: ComplianceGateCardProps) {
  const [activeTab, setActiveTab] = useState<'evidence' | 'fix'>('evidence');

  return (
    <Card.Root
      className="flex flex-col"
      data-testid={`gate-card-${gate.id}`}
    >
      <Card.Header>
        <div className="flex items-center justify-between gap-v-200">
          <div className="flex flex-col gap-v-50">
            <Text typography="subtitle2">{gate.name}</Text>
            <Text typography="body4" foreground="hint-200">
              {gate.issueCount > 0
                ? `이슈 ${gate.issueCount}건 발견`
                : '이슈 없음'}
            </Text>
          </div>
          <Badge
            colorPalette={STATUS_PALETTE[gate.status]}
            shape="pill"
            size="lg"
            aria-label={`게이트 상태: ${STATUS_LABEL[gate.status]}`}
            data-testid="gate-status-badge"
          >
            {STATUS_LABEL[gate.status]}
          </Badge>
        </div>
      </Card.Header>

      <Card.Body className="flex flex-col gap-v-200">
        <Tabs.Root
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'evidence' | 'fix')}
        >
          <Tabs.List aria-label="게이트 상세 탭">
            <Tabs.Button value="evidence">
              증거 목록{gate.issueCount > 0 ? ` (${gate.issueCount})` : ''}
            </Tabs.Button>
            <Tabs.Button value="fix">수정 가이드</Tabs.Button>
          </Tabs.List>

          <Tabs.Panel value="evidence" className="pt-v-200">
            <EvidencePanel evidence={gate.evidence} />
          </Tabs.Panel>

          <Tabs.Panel value="fix" className="pt-v-200">
            <FixGuidePanel fixGuide={gate.fixGuide} />
          </Tabs.Panel>
        </Tabs.Root>
      </Card.Body>
    </Card.Root>
  );
}
