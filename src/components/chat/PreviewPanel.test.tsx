import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PreviewPanel } from './PreviewPanel';

const ARTIFACT = `## Component

\`\`\`tsx
export function PrimaryButton({ children, disabled = false }: { children: string; disabled?: boolean }) {
  return <button disabled={disabled}>{children}</button>;
}
\`\`\`

## Story

\`\`\`tsx
export const Default = {};
\`\`\`

## Test

\`\`\`tsx
expect(true).toBe(true);
\`\`\`

## Validation

- Typecheck: PASS
- Unit: PASS
- Axe: PASS
- Vapor token usage: PASS
`;

const ARTIFACT_SOURCE = `<artifact-meta>
{
  "componentName": "PrimaryButton",
  "primaryExport": "PrimaryButton",
  "defaultProps": { "children": "Save" },
  "variants": [
    { "name": "Default", "props": { "children": "Save" } },
    { "name": "Disabled", "props": { "children": "Save", "disabled": true } }
  ]
}
</artifact-meta>

<artifact type="component" filename="PrimaryButton.tsx">
\`\`\`tsx
export function PrimaryButton({ children, disabled = false }: { children: string; disabled?: boolean }) {
  return <button disabled={disabled}>{children}</button>;
}
\`\`\`
</artifact>`;

describe('PreviewPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('생성물 워크스페이스와 Canvas 기본 탭을 렌더링한다', () => {
    render(<PreviewPanel draft={ARTIFACT} artifactSource={ARTIFACT_SOURCE} onClose={vi.fn()} />);

    expect(screen.getByLabelText('생성물 워크스페이스')).toHaveTextContent(
      'Artifact 워크스페이스',
    );
    expect(screen.getByRole('tab', { name: 'Canvas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTitle('Generated artifact canvas')).toBeInTheDocument();
    expect(screen.getByTitle('Generated artifact canvas')).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-same-origin',
    );
    expect(new URL((screen.getByTitle('Generated artifact canvas') as HTMLIFrameElement).src).origin)
      .not.toBe(window.location.origin);
    expect(screen.getByText('Metadata contract: PASS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disabled variant' })).toBeInTheDocument();
    expect(screen.getByLabelText('Canvas runtime: loading')).toBeInTheDocument();
  });

  it('metadata primaryExport 가 export const 를 가리켜도 Canvas preview 를 막지 않는다', () => {
    const constExportSource = ARTIFACT_SOURCE.replaceAll(
      'function PrimaryButton',
      'const PrimaryButton = function',
    );

    render(<PreviewPanel draft={ARTIFACT} artifactSource={constExportSource} onClose={vi.fn()} />);

    expect(screen.getByTitle('Generated artifact canvas')).toBeInTheDocument();
    expect(screen.getByText('Metadata contract: PASS')).toBeInTheDocument();
  });

  it('Canvas runtime ready/error message 를 parent UI 에 반영한다', async () => {
    render(<PreviewPanel draft={ARTIFACT} artifactSource={ARTIFACT_SOURCE} onClose={vi.fn()} />);
    const iframe = screen.getByTitle('Generated artifact canvas') as HTMLIFrameElement;
    const previewRunId = new URL(iframe.src).searchParams.get('previewRunId');
    const previewOrigin = new URL(iframe.src).origin;

    fireEvent(
      window,
      new MessageEvent('message', {
        origin: previewOrigin,
        source: iframe.contentWindow,
        data: {
          type: 'vapor-preview-ready',
          previewRunId,
          variant: 'Default',
          theme: 'light',
        },
      }),
    );

    await screen.findByLabelText('Canvas runtime: ready');

    fireEvent(
      window,
      new MessageEvent('message', {
        origin: previewOrigin,
        source: iframe.contentWindow,
        data: {
          type: 'vapor-preview-error',
          previewRunId,
          variant: 'Default',
          theme: 'light',
          message: 'preview exploded',
        },
      }),
    );

    await screen.findByLabelText('Canvas runtime: failed');
    expect(screen.getByText('preview exploded')).toBeInTheDocument();
  });

  it('preview postMessage 는 origin/source/run id/type/variant/theme mismatch 를 무시한다', async () => {
    render(<PreviewPanel draft={ARTIFACT} artifactSource={ARTIFACT_SOURCE} onClose={vi.fn()} />);
    const iframe = screen.getByTitle('Generated artifact canvas') as HTMLIFrameElement;
    const previewRunId = new URL(iframe.src).searchParams.get('previewRunId');
    const previewOrigin = new URL(iframe.src).origin;
    const validMessage = {
      type: 'vapor-preview-ready',
      previewRunId,
      variant: 'Default',
      theme: 'light',
    };

    fireEvent(
      window,
      new MessageEvent('message', {
        origin: window.location.origin,
        source: iframe.contentWindow,
        data: validMessage,
      }),
    );
    fireEvent(
      window,
      new MessageEvent('message', {
        origin: previewOrigin,
        source: window,
        data: validMessage,
      }),
    );
    fireEvent(
      window,
      new MessageEvent('message', {
        origin: previewOrigin,
        source: iframe.contentWindow,
        data: { ...validMessage, previewRunId: 'wrong-run' },
      }),
    );
    fireEvent(
      window,
      new MessageEvent('message', {
        origin: previewOrigin,
        source: iframe.contentWindow,
        data: { ...validMessage, type: 'vapor-preview-loaded' },
      }),
    );
    fireEvent(
      window,
      new MessageEvent('message', {
        origin: previewOrigin,
        source: iframe.contentWindow,
        data: { ...validMessage, variant: 'Disabled' },
      }),
    );
    fireEvent(
      window,
      new MessageEvent('message', {
        origin: previewOrigin,
        source: iframe.contentWindow,
        data: { ...validMessage, theme: 'dark' },
      }),
    );

    expect(screen.getByLabelText('Canvas runtime: loading')).toBeInTheDocument();

    fireEvent(
      window,
      new MessageEvent('message', {
        origin: previewOrigin,
        source: iframe.contentWindow,
        data: validMessage,
      }),
    );

    await screen.findByLabelText('Canvas runtime: ready');
  });

  it('preview endpoint 실패를 Canvas failed state 로 표시한다', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Component artifact is required', {
      status: 422,
    }));

    render(<PreviewPanel draft={ARTIFACT} artifactSource={ARTIFACT_SOURCE} onClose={vi.fn()} />);

    await screen.findByLabelText('Canvas runtime: failed');
    expect(
      screen.getByText('Preview endpoint failed (422): Component artifact is required'),
    ).toBeInTheDocument();
  });

  it('artifact-meta 가 없으면 휴리스틱 props 사용을 명시한다', () => {
    render(<PreviewPanel draft={ARTIFACT} artifactSource="<artifact />" onClose={vi.fn()} />);

    expect(screen.getByText('Heuristic props')).toBeInTheDocument();
    expect(screen.getByText(/artifact-meta가 없어/)).toBeInTheDocument();
  });

  it('metadata contract 실패를 Canvas unavailable 로 표시한다', () => {
    const invalidSource = ARTIFACT_SOURCE.replace(
      '"primaryExport": "PrimaryButton"',
      '"primaryExport": "MissingButton"',
    );

    render(<PreviewPanel draft={ARTIFACT} artifactSource={invalidSource} onClose={vi.fn()} />);

    expect(screen.getByText('Metadata contract: FAIL')).toBeInTheDocument();
    expect(screen.getByText(/Metadata contract failed/)).toBeInTheDocument();
    expect(screen.queryByTitle('Generated artifact canvas')).not.toBeInTheDocument();
  });

  it('artifactSource 가 없으면 Canvas 를 실제 preview 로 위장하지 않는다', () => {
    render(<PreviewPanel draft={ARTIFACT} onClose={vi.fn()} />);

    expect(screen.queryByTitle('Generated artifact canvas')).not.toBeInTheDocument();
    expect(screen.getByText('Canvas 사용 불가')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('실제 React preview runtime');
  });

  it('Component 탭에서 생성 코드를 확인할 수 있다', () => {
    render(<PreviewPanel draft={ARTIFACT} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Component' }));

    expect(screen.getByRole('tab', { name: 'Component' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText(/PrimaryButton/)).toBeInTheDocument();
  });

  it('검증 badge 를 표시한다', () => {
    render(<PreviewPanel draft={ARTIFACT} onClose={vi.fn()} />);

    expect(screen.getByText('Typecheck: PASS')).toBeInTheDocument();
    expect(screen.getByText('Unit: PASS')).toBeInTheDocument();
    expect(screen.getByText('Axe: PASS')).toBeInTheDocument();
    expect(screen.getByText('Vapor token usage: PASS')).toBeInTheDocument();
  });

  it('deterministic sample provenance 와 validation 대기 상태를 표시한다', () => {
    render(
      <PreviewPanel
        draft={ARTIFACT.replaceAll('PASS', 'CHECK')}
        artifactSource={ARTIFACT_SOURCE}
        artifactProvenance="deterministic-sample"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Verified sample provenance')).toHaveTextContent(
      'No DeepSeek call',
    );
    expect(screen.getByText('동일 검증 러너')).toBeInTheDocument();
    expect(screen.getByText('Validation: waiting for runner output')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeDisabled();
  });

  it('artifactSource 가 있어도 runner 결과 전에는 승인할 수 없다', () => {
    render(<PreviewPanel draft={ARTIFACT} artifactSource="<artifact />" onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeDisabled();
  });

  it('sample validation 실패 시 waiting notice 대신 runner error 를 보여준다', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 500 }));

    render(
      <PreviewPanel
        draft={ARTIFACT.replaceAll('PASS', 'CHECK')}
        artifactSource={ARTIFACT_SOURCE}
        artifactProvenance="deterministic-sample"
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '검증 실행' }));

    await screen.findByText('Validation request failed (500).');
    await waitFor(() =>
      expect(
        screen.queryByText('Validation: waiting for runner output'),
      ).not.toBeInTheDocument(),
    );
    fetchSpy.mockRestore();
  });

  it('생성물이 비어 있으면 안내 문구를 보여준다', () => {
    render(<PreviewPanel draft="" onClose={vi.fn()} />);
    expect(screen.getByText('워크벤치 준비 상태')).toBeInTheDocument();
    expect(screen.getByText('Canvas 대기')).toBeInTheDocument();
    expect(screen.getByText('검증 게이트 준비됨')).toBeInTheDocument();
    expect(screen.getByText('Axe + token check')).toBeInTheDocument();
  });

  it('닫기 버튼을 누르면 onClose 가 호출된다', () => {
    const onClose = vi.fn();
    render(<PreviewPanel draft={ARTIFACT} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '워크스페이스 닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Canvas runtime timeout 은 failed 와 구별되는 4번째 상태다', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));

    render(<PreviewPanel draft={ARTIFACT} artifactSource={ARTIFACT_SOURCE} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Canvas runtime: loading')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(8_000);
    });

    expect(screen.getByLabelText('Canvas runtime: timeout')).toBeInTheDocument();
    expect(
      screen.getByText('Canvas 런타임 응답 없음'),
    ).toBeInTheDocument();
    // Must NOT show as 'failed'
    expect(screen.queryByLabelText('Canvas runtime: failed')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  describe('Approve gating (G005)', () => {
    const PASS_VALIDATION_RESULT = JSON.stringify({
      status: 'pass',
      durationMs: 100,
      details: [
        { label: 'Typecheck', status: 'pass', message: 'ok' },
        { label: 'Unit', status: 'pass', message: 'ok' },
        { label: 'Runtime Render', status: 'pass', message: 'ok' },
        { label: 'Axe', status: 'pass', message: 'ok' },
        { label: 'Vapor token usage', status: 'pass', message: 'ok' },
        { label: 'Cleanup', status: 'pass', message: 'ok' },
      ],
    });

    function mockFetchWithValidationPass() {
      vi.mocked(fetch).mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/api/deepseek/validate')) {
          return new Response(PASS_VALIDATION_RESULT, { status: 200 });
        }
        // default: preview endpoint returns 200 empty
        return new Response('', { status: 200 });
      });
    }

    it('validation pass 전에는 로컬 승인 버튼이 disabled', () => {
      render(<PreviewPanel draft={ARTIFACT} artifactSource={ARTIFACT_SOURCE} onClose={vi.fn()} />);
      expect(screen.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeDisabled();
    });

    it('validation pass 후 로컬 승인 버튼 enabled', async () => {
      mockFetchWithValidationPass();

      render(<PreviewPanel draft={ARTIFACT} artifactSource={ARTIFACT_SOURCE} onClose={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: '검증 실행' }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeEnabled(),
      );
    });

    it('로컬 승인 클릭 시 onApprovalChange(true) 호출', async () => {
      mockFetchWithValidationPass();

      const onApprovalChange = vi.fn();
      render(
        <PreviewPanel
          draft={ARTIFACT}
          artifactSource={ARTIFACT_SOURCE}
          onApprovalChange={onApprovalChange}
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: '검증 실행' }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeEnabled(),
      );

      fireEvent.click(screen.getByRole('button', { name: '현재 artifact 로컬 승인' }));
      expect(onApprovalChange).toHaveBeenCalledWith(true);
      await screen.findByText('로컬 리뷰 승인 완료');
      await screen.findByText('로컬 리뷰 승인만 기록되었습니다. 저장소 변경이나 PR은 생성되지 않습니다.');
    });

    it('새 artifactSource 로 remount 되면 승인 상태가 초기화된다', async () => {
      mockFetchWithValidationPass();

      const { rerender } = render(
        <PreviewPanel
          key="run-1"
          draft={ARTIFACT}
          artifactSource={ARTIFACT_SOURCE}
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: '검증 실행' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeEnabled(),
      );
      fireEvent.click(screen.getByRole('button', { name: '현재 artifact 로컬 승인' }));
      await screen.findByText('로컬 리뷰 승인 완료');

      // 새 artifactRun — key 변경으로 remount
      rerender(
        <PreviewPanel
          key="run-2"
          draft={ARTIFACT}
          artifactSource={ARTIFACT_SOURCE + ' v2'}
          onClose={vi.fn()}
        />,
      );

      expect(screen.queryByText('로컬 리뷰 승인 완료')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '현재 artifact 로컬 승인' })).toBeDisabled();
    });
  });

  // A04: tab role 과 tabpanel role 이 id/aria-labelledby/aria-controls 로
  // 연결되어 스크린리더 사용자가 active 탭과 본문 관계를 인식할 수 있어야 한다.
  it('탭 본문에 role="tabpanel" + aria-labelledby + id 가 연결된다', () => {
    render(<PreviewPanel draft={ARTIFACT} artifactSource={ARTIFACT_SOURCE} onClose={vi.fn()} />);

    const canvasTab = screen.getByRole('tab', { name: 'Canvas' });
    expect(canvasTab).toHaveAttribute('id', 'artifact-tab-canvas');
    expect(canvasTab).toHaveAttribute('aria-controls', 'artifact-tabpanel-canvas');

    const tabpanel = screen.getByRole('tabpanel');
    expect(tabpanel).toHaveAttribute('id', 'artifact-tabpanel-canvas');
    expect(tabpanel).toHaveAttribute('aria-labelledby', 'artifact-tab-canvas');
    // 키보드로 본문에 fokus 이동 가능
    expect(tabpanel).toHaveAttribute('tabindex', '0');
  });

  describe('Repair attempts limit (U06)', () => {
    const FAIL_VALIDATION_RESULT = JSON.stringify({
      status: 'fail',
      durationMs: 100,
      details: [
        {
          label: 'Typecheck',
          status: 'fail',
          message: 'fail',
          output: 'TS2322: Type error',
        },
        { label: 'Unit', status: 'pass', message: 'ok' },
        { label: 'Runtime Render', status: 'pass', message: 'ok' },
        { label: 'Axe', status: 'pass', message: 'ok' },
        { label: 'Vapor token usage', status: 'pass', message: 'ok' },
        { label: 'Cleanup', status: 'pass', message: 'ok' },
      ],
    });

    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(FAIL_VALIDATION_RESULT, { status: 200 })),
      );
    });

    it('attempts 가 max 미만이면 "실패 수정" 버튼이 활성화되고 카운터를 표시한다', async () => {
      const onRepair = vi.fn();
      render(
        <PreviewPanel
          draft={ARTIFACT}
          artifactSource={ARTIFACT_SOURCE}
          onRepair={onRepair}
          repairChainAttempts={1}
          maxRepairAttemptsPerChain={3}
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: '검증 실행' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /실패 수정/ })).toBeEnabled(),
      );
      expect(screen.getByTestId('repair-attempts-status')).toHaveTextContent('수정 1/3');
      fireEvent.click(screen.getByRole('button', { name: /실패 수정/ }));
      expect(onRepair).toHaveBeenCalledTimes(1);
    });

    it('attempts 가 max 와 같으면 버튼 disabled + "최대 수정 횟수 초과" 표시', async () => {
      const onRepair = vi.fn();
      render(
        <PreviewPanel
          draft={ARTIFACT}
          artifactSource={ARTIFACT_SOURCE}
          onRepair={onRepair}
          repairChainAttempts={3}
          maxRepairAttemptsPerChain={3}
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: '검증 실행' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /실패 수정/ })).toBeDisabled(),
      );
      expect(screen.getByTestId('repair-attempts-status')).toHaveTextContent(
        '최대 수정 횟수 초과 (3/3)',
      );
      fireEvent.click(screen.getByRole('button', { name: /실패 수정/ }));
      // disabled 버튼 클릭은 콜백을 발사하지 않음
      expect(onRepair).not.toHaveBeenCalled();
    });

    it('한도 도달 시 ValidationPanel gate 단위 수정 CTA 도 비활성화된다', async () => {
      const onRepair = vi.fn();
      render(
        <PreviewPanel
          draft={ARTIFACT}
          artifactSource={ARTIFACT_SOURCE}
          onRepair={onRepair}
          repairChainAttempts={3}
          maxRepairAttemptsPerChain={3}
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: '검증 실행' }));
      // validation 탭 클릭
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: '검증' })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole('tab', { name: '검증' }));
      // gate 카드의 "이 gate 수정" 버튼은 onRepairGate 가 undefined 일 때 렌더되지 않음
      expect(screen.queryByRole('button', { name: /이 gate 수정/ })).not.toBeInTheDocument();
    });

    it('한도 prop 이 없으면 (기존 호출자 호환) 항상 enabled', async () => {
      const onRepair = vi.fn();
      render(
        <PreviewPanel
          draft={ARTIFACT}
          artifactSource={ARTIFACT_SOURCE}
          onRepair={onRepair}
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: '검증 실행' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /실패 수정/ })).toBeEnabled(),
      );
      // 한도 카운터 표시 자체가 없어야 함 (default = Infinity)
      expect(screen.queryByTestId('repair-attempts-status')).not.toBeInTheDocument();
    });
  });
});
