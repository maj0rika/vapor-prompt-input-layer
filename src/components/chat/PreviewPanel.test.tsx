import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewPanel } from './PreviewPanel';

const ARTIFACT = `## Component

\`\`\`tsx
export function PrimaryButton() {
  return <button>Save</button>;
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

describe('PreviewPanel', () => {
  it('생성물 워크스페이스와 Component 탭을 렌더링한다', () => {
    render(<PreviewPanel draft={ARTIFACT} onClose={vi.fn()} />);

    expect(screen.getByLabelText('생성물 워크스페이스')).toHaveTextContent(
      'Artifact workspace',
    );
    expect(screen.getByRole('button', { name: 'Component' })).toHaveAttribute(
      'aria-current',
      'page',
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

  it('생성물이 비어 있으면 안내 문구를 보여준다', () => {
    render(<PreviewPanel draft="" onClose={vi.fn()} />);
    expect(screen.getByText('아직 생성된 artifact가 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('Axe + token check')).toBeInTheDocument();
  });

  it('닫기 버튼을 누르면 onClose 가 호출된다', () => {
    const onClose = vi.fn();
    render(<PreviewPanel draft={ARTIFACT} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '워크스페이스 닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
