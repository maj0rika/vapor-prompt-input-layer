import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@vapor-ui/core';
import { ComplianceGateCard } from './ComplianceGateCard';
import type { ComplianceGate } from './mockReport';

const FAIL_GATE: ComplianceGate = {
  id: 'vapor-components',
  name: 'Vapor 컴포넌트 사용',
  status: 'FAIL',
  issueCount: 2,
  evidence: [
    {
      file: 'src/components/chat/MessageBubble.tsx',
      line: 42,
      snippet: '<button onClick={...}>전송</button>',
    },
    {
      file: 'src/components/prompt/PromptBar.tsx',
      line: 88,
      snippet: '<button className="btn">확인</button>',
    },
  ],
  fixGuide: {
    steps: [
      { step: 1, description: 'Button 을 import 합니다.' },
      { step: 2, description: 'native <button> 를 교체합니다.' },
    ],
    docLink: 'https://vapor-ui.io/docs/components/button',
  },
};

const PASS_GATE: ComplianceGate = {
  id: 'layout',
  name: '레이아웃 품질',
  status: 'PASS',
  issueCount: 0,
  evidence: [],
  fixGuide: { steps: [] },
};

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider defaultTheme="light">{ui}</ThemeProvider>);
}

describe('ComplianceGateCard', () => {
  it('FAIL 상태 배지가 올바르게 렌더된다', () => {
    renderWithTheme(<ComplianceGateCard gate={FAIL_GATE} />);
    const badge = screen.getByTestId('gate-status-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('실패');
  });

  it('PASS 상태 배지가 올바르게 렌더된다', () => {
    renderWithTheme(<ComplianceGateCard gate={PASS_GATE} />);
    const badge = screen.getByTestId('gate-status-badge');
    expect(badge).toHaveTextContent('통과');
  });

  it('게이트 이름이 표시된다', () => {
    renderWithTheme(<ComplianceGateCard gate={FAIL_GATE} />);
    expect(screen.getByText('Vapor 컴포넌트 사용')).toBeInTheDocument();
  });

  it('이슈 수가 헤더에 표시된다', () => {
    renderWithTheme(<ComplianceGateCard gate={FAIL_GATE} />);
    expect(screen.getByText(/이슈 2건 발견/)).toBeInTheDocument();
  });

  it('기본 탭은 증거 목록이며 evidence 아이템이 표시된다', () => {
    renderWithTheme(<ComplianceGateCard gate={FAIL_GATE} />);
    // 증거 탭이 기본 활성 → 파일 경로가 보여야 함
    expect(
      screen.getByText('src/components/chat/MessageBubble.tsx'),
    ).toBeInTheDocument();
  });

  it('수정 가이드 탭으로 전환하면 fix steps 가 표시된다', () => {
    renderWithTheme(<ComplianceGateCard gate={FAIL_GATE} />);

    const fixTab = screen.getByRole('tab', { name: /수정 가이드/ });
    fireEvent.click(fixTab);

    expect(screen.getByText('Button 을 import 합니다.')).toBeInTheDocument();
    expect(screen.getByText('native <button> 를 교체합니다.')).toBeInTheDocument();
  });

  it('PASS 게이트는 이슈 없음 메시지를 표시한다', () => {
    renderWithTheme(<ComplianceGateCard gate={PASS_GATE} />);
    expect(screen.getByText('이슈 없음')).toBeInTheDocument();
  });

  it('수정 가이드 탭에 doc link 가 렌더된다', () => {
    renderWithTheme(<ComplianceGateCard gate={FAIL_GATE} />);
    fireEvent.click(screen.getByRole('tab', { name: /수정 가이드/ }));
    const link = screen.getByRole('link', { name: /Vapor 공식 문서 열기/ });
    expect(link).toHaveAttribute('href', 'https://vapor-ui.io/docs/components/button');
  });
});
