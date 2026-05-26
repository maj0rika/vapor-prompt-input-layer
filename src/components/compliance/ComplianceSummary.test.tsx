import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@vapor-ui/core';
import { ComplianceSummary } from './ComplianceSummary';
import type { ComplianceReport } from './mockReport';

const WARN_REPORT: ComplianceReport = {
  id: 'test-001',
  timestamp: '2026-05-26T09:00:00Z',
  overallStatus: 'WARN',
  score: 71,
  gateCount: { pass: 3, warn: 2, fail: 2 },
  gates: [],
};

const PASS_REPORT: ComplianceReport = {
  id: 'test-002',
  timestamp: '2026-05-26T10:00:00Z',
  overallStatus: 'PASS',
  score: 100,
  gateCount: { pass: 7, warn: 0, fail: 0 },
  gates: [],
};

const FAIL_REPORT: ComplianceReport = {
  id: 'test-003',
  timestamp: '2026-05-26T11:00:00Z',
  overallStatus: 'FAIL',
  score: 28,
  gateCount: { pass: 1, warn: 1, fail: 5 },
  gates: [],
};

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider defaultTheme="light">{ui}</ThemeProvider>);
}

describe('ComplianceSummary', () => {
  it('WARN 종합 상태 배지가 표시된다', () => {
    renderWithTheme(<ComplianceSummary report={WARN_REPORT} />);
    expect(screen.getByLabelText(/종합 결과: 경고/)).toBeInTheDocument();
  });

  it('PASS 종합 상태 배지가 표시된다', () => {
    renderWithTheme(<ComplianceSummary report={PASS_REPORT} />);
    expect(screen.getByLabelText(/종합 결과: 통과/)).toBeInTheDocument();
  });

  it('FAIL 종합 상태 배지가 표시된다', () => {
    renderWithTheme(<ComplianceSummary report={FAIL_REPORT} />);
    expect(screen.getByLabelText(/종합 결과: 실패/)).toBeInTheDocument();
  });

  it('종합 점수가 표시된다', () => {
    renderWithTheme(<ComplianceSummary report={WARN_REPORT} />);
    expect(screen.getByText('71점')).toBeInTheDocument();
  });

  it('점수 progressbar 의 aria-valuenow 가 점수와 일치한다', () => {
    renderWithTheme(<ComplianceSummary report={WARN_REPORT} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '71');
  });

  it('gate 집계 통과/경고/실패 수치가 표시된다', () => {
    renderWithTheme(<ComplianceSummary report={WARN_REPORT} />);
    // 3 pass, 2 warn, 2 fail
    const summary = screen.getByTestId('compliance-summary');
    expect(summary).toHaveTextContent('3');
    expect(summary).toHaveTextContent('2');
  });

  it('만점 리포트는 progressbar 가 100%다', () => {
    renderWithTheme(<ComplianceSummary report={PASS_REPORT} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });
});
