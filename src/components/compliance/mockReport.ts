/**
 * TEMP: Mock ComplianceReport fixture.
 * worker-engine 이 실제 스캐너 + 타입을 제공하면 이 파일은 제거하고
 * engine 타입을 import 한다.
 */

export type GateStatus = 'PASS' | 'WARN' | 'FAIL';

export interface Evidence {
  file: string;
  line: number;
  snippet: string;
}

export interface FixStep {
  step: number;
  description: string;
}

export interface ComplianceGate {
  id: string;
  name: string;
  status: GateStatus;
  issueCount: number;
  evidence: Evidence[];
  fixGuide: {
    steps: FixStep[];
    docLink?: string;
  };
}

export interface ComplianceReport {
  id: string;
  timestamp: string;
  overallStatus: GateStatus;
  /** 0–100 종합 점수 */
  score: number;
  gateCount: { pass: number; warn: number; fail: number };
  gates: ComplianceGate[];
}

export const MOCK_REPORT: ComplianceReport = {
  id: 'mock-001',
  timestamp: '2026-05-26T09:00:00Z',
  overallStatus: 'WARN',
  score: 71,
  gateCount: { pass: 3, warn: 2, fail: 2 },
  gates: [
    {
      id: 'layout',
      name: '레이아웃 품질',
      status: 'PASS',
      issueCount: 0,
      evidence: [],
      fixGuide: { steps: [] },
    },
    {
      id: 'vapor-components',
      name: 'Vapor 컴포넌트 사용',
      status: 'FAIL',
      issueCount: 3,
      evidence: [
        {
          file: 'src/components/chat/MessageBubble.tsx',
          line: 42,
          snippet: '<button onClick={...}>전송</button>',
        },
        {
          file: 'src/components/prompt/PromptBar.tsx',
          line: 88,
          snippet: '<button className="btn-primary">확인</button>',
        },
        {
          file: 'src/components/chat/EmptyState.tsx',
          line: 15,
          snippet: '<button style={{color:"blue"}}>시작</button>',
        },
      ],
      fixGuide: {
        steps: [
          { step: 1, description: '@vapor-ui/core 에서 Button 컴포넌트를 import 합니다.' },
          {
            step: 2,
            description: 'native <button> 를 <Button variant="solid"> 로 교체합니다.',
          },
          { step: 3, description: 'onClick, disabled, aria-label 등 props 를 유지합니다.' },
        ],
        docLink: 'https://vapor-ui.io/docs/components/button',
      },
    },
    {
      id: 'token-style',
      name: '토큰 & 스타일',
      status: 'WARN',
      issueCount: 2,
      evidence: [
        {
          file: 'src/components/chat/ConversationView.tsx',
          line: 67,
          snippet: 'color: "#333"',
        },
        {
          file: 'src/components/prompt/PromptBar.tsx',
          line: 103,
          snippet: 'background: "white"',
        },
      ],
      fixGuide: {
        steps: [
          { step: 1, description: '하드코딩된 색상값을 Vapor 토큰으로 교체합니다.' },
          {
            step: 2,
            description: 'text-v-foreground-normal 등 v- 유틸리티 클래스를 사용합니다.',
          },
          { step: 3, description: 'bg-v-canvas-100 으로 배경색을 지정합니다.' },
        ],
        docLink: 'https://vapor-ui.io/docs/tokens/color',
      },
    },
    {
      id: 'accessibility',
      name: '접근성',
      status: 'FAIL',
      issueCount: 4,
      evidence: [
        {
          file: 'src/components/chat/AttachmentChip.tsx',
          line: 23,
          snippet: '<img src={url} />',
        },
        {
          file: 'src/components/chat/PreviewPanel.tsx',
          line: 156,
          snippet: '<div onClick={handleClick}>',
        },
        {
          file: 'src/components/prompt/PromptBar.tsx',
          line: 44,
          snippet: '<input type="text" />',
        },
        {
          file: 'src/components/chat/EmptyState.tsx',
          line: 31,
          snippet: '<div role="button">',
        },
      ],
      fixGuide: {
        steps: [
          { step: 1, description: '<img> 에 alt 속성을 추가합니다.' },
          {
            step: 2,
            description: 'onClick div 는 <button> 또는 Vapor Button 으로 교체합니다.',
          },
          {
            step: 3,
            description: '<input> 에 aria-label 또는 연결된 <label> 을 추가합니다.',
          },
          {
            step: 4,
            description:
              'role="button" div 는 tabIndex={0} 과 키보드 핸들러를 추가합니다.',
          },
        ],
        docLink: 'https://vapor-ui.io/docs/accessibility',
      },
    },
    {
      id: 'responsive-theme',
      name: '반응형 & 테마',
      status: 'PASS',
      issueCount: 0,
      evidence: [],
      fixGuide: { steps: [] },
    },
    {
      id: 'code-quality',
      name: '코드 품질',
      status: 'WARN',
      issueCount: 1,
      evidence: [
        {
          file: 'src/components/chat/ChatScreen.tsx',
          line: 201,
          snippet: '// TODO: previewWidth 퍼시스턴스 미구현',
        },
      ],
      fixGuide: {
        steps: [
          { step: 1, description: 'TODO 주석을 이슈로 전환하거나 구현합니다.' },
          {
            step: 2,
            description: 'localStorage 를 사용해 previewWidth 상태를 유지합니다.',
          },
        ],
      },
    },
    {
      id: 'docs-readiness',
      name: '문서 준비도',
      status: 'PASS',
      issueCount: 0,
      evidence: [],
      fixGuide: { steps: [] },
    },
  ],
};
