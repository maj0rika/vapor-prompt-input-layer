import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttachmentItem } from './AttachmentItem';
import type { PromptAttachment } from './types';

const makeAttachment = (
  overrides: Partial<PromptAttachment> = {},
): PromptAttachment => ({
  id: 'a1',
  fileName: 'report.pdf',
  size: 2048,
  status: 'idle',
  ...overrides,
});

const renderItem = (attachment: PromptAttachment, onRemove = vi.fn()) =>
  render(
    <ul>
      <AttachmentItem attachment={attachment} onRemove={onRemove} />
    </ul>,
  );

describe('AttachmentItem', () => {
  it('파일명과 크기를 표시한다', () => {
    renderItem(makeAttachment({ fileName: 'report.pdf', size: 2048 }));
    expect(screen.getAllByText('report.pdf').length).toBeGreaterThan(0);
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('uploading 상태를 표시하고 aria-busy 를 설정한다', () => {
    renderItem(makeAttachment({ status: 'uploading' }));
    expect(screen.getByText('업로드 중')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveAttribute('aria-busy', 'true');
  });

  it('done 상태를 표시한다', () => {
    renderItem(makeAttachment({ status: 'done' }));
    expect(screen.getByText('완료')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveAttribute('aria-busy', 'false');
  });

  it('error 상태에서 에러 메시지를 alert 로 표시한다', () => {
    renderItem(
      makeAttachment({ status: 'error', errorMessage: '업로드에 실패했습니다.' }),
    );
    expect(screen.getByText('실패')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('업로드에 실패했습니다.');
  });

  it('제거 버튼을 누르면 onRemove 가 해당 id 로 호출된다', () => {
    const onRemove = vi.fn();
    renderItem(makeAttachment({ id: 'file-9' }), onRemove);
    fireEvent.click(screen.getByRole('button', { name: /첨부 제거/ }));
    expect(onRemove).toHaveBeenCalledWith('file-9');
  });

  it('제거 버튼 라벨에 파일명이 포함된다', () => {
    renderItem(makeAttachment({ fileName: 'photo.png' }));
    expect(
      screen.getByRole('button', { name: 'photo.png 첨부 제거' }),
    ).toBeInTheDocument();
  });
});
