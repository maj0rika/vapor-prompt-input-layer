import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ValidationPanel, type RemoteValidationResult } from './ValidationPanel';

function makeResult(overrides: Partial<RemoteValidationResult> = {}): RemoteValidationResult {
  return {
    status: 'pass',
    durationMs: 1234,
    details: [],
    ...overrides,
  };
}

function makeDetail(
  label: string,
  status: 'pass' | 'warn' | 'fail',
  message = `${label} completed`,
  output?: string,
): RemoteValidationResult['details'][0] {
  return { label, status, message, durationMs: 100, output };
}

const SIX_PASS_DETAILS = [
  makeDetail('Typecheck', 'pass'),
  makeDetail('Unit', 'pass'),
  makeDetail('Runtime Render', 'pass'),
  makeDetail('Axe', 'pass'),
  makeDetail('Vapor token usage', 'pass'),
  makeDetail('Cleanup', 'pass'),
];

describe('ValidationPanel', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('6 pass detail 표시 시 전체 뱃지=pass + count="6 gates · 6 pass · 0 fail"', () => {
    render(
      <ValidationPanel
        result={makeResult({ status: 'pass', details: SIX_PASS_DETAILS })}
        status="idle"
      />,
    );

    // Overall pass badge
    expect(screen.getByText('Pass')).toBeInTheDocument();

    // Summary count
    expect(screen.getByText('6 gates · 6 pass · 0 fail')).toBeInTheDocument();

    // Summary list items: one per gate (Label: STATUS format)
    const summaryItems = screen
      .getAllByRole('listitem')
      .filter((el) => /^(Typecheck|Unit|Runtime Render|Axe|Vapor token usage|Cleanup): (PASS|FAIL|WARN)$/.test(el.textContent?.trim() ?? ''));
    expect(summaryItems).toHaveLength(6);
  });

  it('1 fail detail 시 fix action 버튼 노출 + 클릭 시 onRepairGate(해당 label) 호출', () => {
    const onRepairGate = vi.fn();
    render(
      <ValidationPanel
        result={makeResult({
          status: 'fail',
          details: [makeDetail('Typecheck', 'fail', 'Type errors found')],
        })}
        status="idle"
        onRepairGate={onRepairGate}
      />,
    );

    const fixButton = screen.getByRole('button', { name: '이 gate 수정' });
    expect(fixButton).toBeInTheDocument();

    fireEvent.click(fixButton);
    expect(onRepairGate).toHaveBeenCalledWith('Typecheck');
  });

  it('output disclosure 토글 → output 텍스트 노출/숨김', () => {
    render(
      <ValidationPanel
        result={makeResult({
          status: 'pass',
          details: [makeDetail('Unit', 'pass', 'All tests pass', 'Test output line 1\nline 2')],
        })}
        status="idle"
      />,
    );

    // pass gate: output is hidden by default (collapsed)
    expect(screen.queryByText(/Test output line 1/)).not.toBeInTheDocument();

    // Click disclosure button to open
    const disclosureButton = screen.getByRole('button', { name: 'Unit output' });
    fireEvent.click(disclosureButton);
    expect(screen.getByText(/Test output line 1/)).toBeInTheDocument();

    // Click again to close
    fireEvent.click(disclosureButton);
    expect(screen.queryByText(/Test output line 1/)).not.toBeInTheDocument();
  });

  it('copy output 클릭 시 clipboard.writeText 호출 (jsdom mock)', () => {
    render(
      <ValidationPanel
        result={makeResult({
          status: 'pass',
          details: [makeDetail('Axe', 'pass', 'No violations', 'axe output text')],
        })}
        status="idle"
      />,
    );

    // Open disclosure first (pass gate is collapsed by default)
    fireEvent.click(screen.getByRole('button', { name: 'Axe output' }));

    // Click copy
    fireEvent.click(screen.getByRole('button', { name: '출력 복사' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('axe output text');
  });
});
