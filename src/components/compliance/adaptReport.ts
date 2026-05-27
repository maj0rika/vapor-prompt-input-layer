import type { ComplianceReport as EngineReport, Gate as EngineGate } from '../../compliance/types';
import type { ComplianceReport as ShellReport, ComplianceGate, Evidence, FixStep } from './mockReport';

/**
 * 게이트별 한국어 표기 + Vapor 문서 링크 매핑.
 * 엔진은 영문 name 을 반환한다 (deterministic 식별성 우선). UI 표기는 여기서 한국어화.
 */
const GATE_META: Record<string, { name: string; docLink?: string }> = {
  'layout-overflow': {
    name: '레이아웃 품질',
    docLink: 'https://vapor-ui.goorm.io/docs/getting-started/principles',
  },
  'vapor-components': {
    name: 'Vapor 컴포넌트 사용',
    docLink: 'https://vapor-ui.goorm.io/docs/components/button',
  },
  'design-tokens': {
    name: '토큰 & 스타일',
    docLink: 'https://vapor-ui.goorm.io/docs/getting-started/tailwindcss-v4',
  },
  accessibility: {
    name: '접근성',
    docLink: 'https://vapor-ui.goorm.io/docs/getting-started/eslint',
  },
  'responsive-design': {
    name: '반응형 & 테마',
    docLink: 'https://vapor-ui.goorm.io/docs/getting-started/principles',
  },
  documentation: { name: '문서 준비도' },
  'code-quality': {
    name: '코드 품질',
    docLink: 'https://vapor-ui.goorm.io/docs/getting-started/eslint',
  },
};

/** Demo violation — raw hex color to trigger FAIL gate for portfolio presentation. */
const _DEMO_RAW_COLOR = '#ff3366';
void _DEMO_RAW_COLOR; // intentional demo violation, suppress unused warning

function adaptGate(g: EngineGate): ComplianceGate {
  const meta = GATE_META[g.gateId];
  const evidence: Evidence[] = g.evidence.map((e) => {
    let file = '';
    let line = 0;
    if (e.location) {
      const colonIdx = e.location.lastIndexOf(':');
      if (colonIdx > 0) {
        file = e.location.slice(0, colonIdx);
        const linePart = e.location.slice(colonIdx + 1);
        line = parseInt(linePart, 10) || 0;
      } else {
        file = e.location;
      }
    }
    return { file, line, snippet: e.message };
  });
  const steps: FixStep[] = g.fixGuide.map((f, idx) => ({
    step: idx + 1,
    description: f.title + (f.detail ? ` — ${f.detail}` : ''),
  }));
  return {
    id: g.gateId,
    name: meta?.name ?? g.name,
    status: g.status,
    issueCount: g.evidence.length,
    evidence,
    fixGuide: {
      steps,
      docLink: meta?.docLink,
    },
  };
}

function countGates(gates: ComplianceGate[]) {
  return gates.reduce(
    (acc, g) => {
      if (g.status === 'PASS') acc.pass += 1;
      else if (g.status === 'WARN') acc.warn += 1;
      else acc.fail += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 },
  );
}

/**
 * 엔진 ComplianceReport → 셸 view-model ComplianceReport.
 * 엔진은 deterministic 데이터 모델, 셸은 UI 모델.
 */
export function adaptEngineReport(engine: EngineReport): ShellReport {
  const gates = engine.gates.map(adaptGate);
  return {
    id: `compliance-${engine.generatedAt}`,
    timestamp: engine.generatedAt,
    overallStatus: engine.overallStatus,
    score: engine.overallScore,
    gateCount: countGates(gates),
    gates,
  };
}
