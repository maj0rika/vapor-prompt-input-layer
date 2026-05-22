import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PromptBar } from './PromptBar';

const MODE_OPTIONS = [
  { id: 'component', label: 'Component' },
  { id: 'token-sync', label: 'Token Sync' },
  { id: 'a11y-audit', label: 'A11y Audit' },
  { id: 'story-test', label: 'Story/Test' },
];

describe('PromptBar', () => {
  it('mode selector 와 inline attach button 을 표시한다', () => {
    render(<PromptBar modeOptions={MODE_OPTIONS} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('자동화 모드 선택')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '참고 파일 첨부' })).toBeInTheDocument();
    expect(screen.getByLabelText('자동화 프롬프트 입력')).toBeInTheDocument();
  });

  it('제출 payload 에 mode 와 text 를 포함한다', () => {
    const onSubmit = vi.fn();
    render(<PromptBar modeOptions={MODE_OPTIONS} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('자동화 프롬프트 입력'), {
      target: { value: 'primary 버튼 생성' },
    });
    fireEvent.click(screen.getByRole('button', { name: '자동화 실행' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'primary 버튼 생성',
        mode: 'component',
        dataSources: ['component'],
      }),
    );
  });

  it('첨부 파일 텍스트를 읽어 payload 에 포함한다', async () => {
    const onSubmit = vi.fn();
    render(
      <PromptBar
        modeOptions={MODE_OPTIONS}
        accept={['.json']}
        onSubmit={onSubmit}
      />,
    );
    const file = new File(['{"color.primary.500":"#0066ff"}'], 'tokens.json', {
      type: 'application/json',
    });

    fireEvent.change(screen.getByLabelText('자동화 프롬프트 입력'), {
      target: { value: '토큰 매핑' },
    });
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

    await waitFor(() => expect(screen.getByText('완료')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '자동화 실행' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            fileName: 'tokens.json',
            kind: 'tokens',
            contentText: expect.stringContaining('color.primary.500'),
          }),
        ],
      }),
    );
  });

  it('긴 첨부 파일은 잘라서 truncated 상태로 제출한다', async () => {
    const onSubmit = vi.fn();
    render(
      <PromptBar
        modeOptions={MODE_OPTIONS}
        accept={['.md']}
        onSubmit={onSubmit}
      />,
    );
    const file = new File(['x'.repeat(20_000)], 'large-spec.md', {
      type: 'text/markdown',
    });

    fireEvent.change(screen.getByLabelText('자동화 프롬프트 입력'), {
      target: { value: '스펙 참고해서 생성' },
    });
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

    await waitFor(() => expect(screen.getByText('일부 포함')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '자동화 실행' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            fileName: 'large-spec.md',
            truncated: true,
            contentText: expect.stringContaining('[trimmed]'),
          }),
        ],
      }),
    );
  });

  it('지원하지 않는 확장자는 alert 로 표시한다', () => {
    render(
      <PromptBar
        modeOptions={MODE_OPTIONS}
        accept={['.json']}
        onSubmit={vi.fn()}
      />,
    );
    const file = new File(['bad'], 'bad.exe');

    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('지원하지 않는 파일 형식');
  });

  it('여러 번 나눠 첨부해도 maxFiles 를 초과하지 않는다', async () => {
    render(
      <PromptBar
        modeOptions={MODE_OPTIONS}
        accept={['.json']}
        maxFiles={1}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(['{}'], 'first.json', { type: 'application/json' })],
      },
    });
    await waitFor(() => expect(screen.getByText('완료')).toBeInTheDocument());

    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(['{}'], 'second.json', { type: 'application/json' })],
      },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      '파일을 하나만 첨부할 수 있습니다.',
    );
    expect(screen.queryByText('second.json')).not.toBeInTheDocument();
  });
});
