import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewPanel } from './PreviewPanel';

describe('PreviewPanel', () => {
  it('초안 텍스트를 렌더링한다', () => {
    render(<PreviewPanel draft="제안 수정본\n다듬어진 문장" onClose={vi.fn()} />);
    expect(screen.getByLabelText('초안 미리보기')).toHaveTextContent(
      '다듬어진 문장',
    );
  });

  it('초안이 비어 있으면 안내 문구를 보여준다', () => {
    render(<PreviewPanel draft="" onClose={vi.fn()} />);
    expect(
      screen.getByText('에이전트가 초안을 작성하면 여기에 표시됩니다.'),
    ).toBeInTheDocument();
  });

  it('닫기 버튼을 누르면 onClose 가 호출된다', () => {
    const onClose = vi.fn();
    render(<PreviewPanel draft="초안" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '미리보기 닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
