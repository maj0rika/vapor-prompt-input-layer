import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  it('생성물 워크스페이스와 Canvas 기본 탭을 렌더링한다', () => {
    render(<PreviewPanel draft={ARTIFACT} artifactSource={ARTIFACT_SOURCE} onClose={vi.fn()} />);

    expect(screen.getByLabelText('생성물 워크스페이스')).toHaveTextContent(
      'Artifact workspace',
    );
    expect(screen.getByRole('tab', { name: 'Canvas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTitle('Generated artifact canvas')).toBeInTheDocument();
    expect(screen.getByText('Metadata contract: PASS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disabled variant' })).toBeInTheDocument();
    expect(screen.getByLabelText('Canvas runtime: loading')).toBeInTheDocument();
  });

  it('Canvas runtime ready/error message 를 parent UI 에 반영한다', async () => {
    render(<PreviewPanel draft={ARTIFACT} artifactSource={ARTIFACT_SOURCE} onClose={vi.fn()} />);
    const iframe = screen.getByTitle('Generated artifact canvas') as HTMLIFrameElement;
    const previewRunId = new URL(iframe.src).searchParams.get('previewRunId');

    fireEvent(
      window,
      new MessageEvent('message', {
        origin: window.location.origin,
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
        origin: window.location.origin,
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
    expect(screen.getByText('Canvas unavailable')).toBeInTheDocument();
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
    expect(screen.getByText('Same validation runner')).toBeInTheDocument();
    expect(screen.getByText('Validation: waiting for runner output')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve current artifact' })).toBeDisabled();
  });

  it('artifactSource 가 있어도 runner 결과 전에는 승인할 수 없다', () => {
    render(<PreviewPanel draft={ARTIFACT} artifactSource="<artifact />" onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Approve current artifact' })).toBeDisabled();
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

    fireEvent.click(screen.getByRole('button', { name: 'Run validation' }));

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
    expect(screen.getByText('Workbench readiness')).toBeInTheDocument();
    expect(screen.getByText('Canvas waiting')).toBeInTheDocument();
    expect(screen.getByText('Validation gates ready')).toBeInTheDocument();
    expect(screen.getByText('Axe + token check')).toBeInTheDocument();
  });

  it('닫기 버튼을 누르면 onClose 가 호출된다', () => {
    const onClose = vi.fn();
    render(<PreviewPanel draft={ARTIFACT} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '워크스페이스 닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
