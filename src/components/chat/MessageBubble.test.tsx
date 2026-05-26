import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from '../../agent';

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  role: 'assistant',
  text: '안녕하세요',
  status: 'done',
  createdAt: Date.UTC(2026, 0, 1, 9, 30),
  ...overrides,
});

describe('MessageBubble', () => {
  it('user 메시지를 렌더링한다', () => {
    render(<MessageBubble message={makeMessage({ role: 'user', text: '질문' })} />);
    const bubble = screen.getByText('질문').closest('[data-role]');
    expect(bubble).toHaveAttribute('data-role', 'user');
  });

  it('스트리밍 중이고 본문이 비어 있으면 타이핑 인디케이터를 보여준다', () => {
    render(
      <MessageBubble
        message={makeMessage({ role: 'assistant', text: '', status: 'streaming' })}
      />,
    );
    expect(screen.getByRole('status', { name: '응답 생성 중' })).toBeInTheDocument();
  });

  it('스트리밍 중 본문이 들어오면 텍스트와 진행 인디케이터를 함께 보여준다', () => {
    render(
      <MessageBubble
        message={makeMessage({ text: '생성 중인 답변', status: 'streaming' })}
      />,
    );
    expect(screen.getByText('생성 중인 답변')).toBeInTheDocument();
    // 텍스트가 흘러도 인디케이터는 유지되어 사용자가 진행 상태를 인지한다.
    expect(screen.getByRole('status', { name: '응답 생성 중' })).toBeInTheDocument();
  });

  it('done 상태에서는 진행 인디케이터가 사라진다', () => {
    render(
      <MessageBubble
        message={makeMessage({ text: '완성된 답변', status: 'done' })}
      />,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('error 상태에서 에러 메시지를 alert 로 보여준다', () => {
    render(
      <MessageBubble
        message={makeMessage({
          status: 'error',
          errorMessage: '응답 생성에 실패했습니다.',
        })}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('응답 생성에 실패했습니다.');
  });

  it('cancelled 상태에서 중단 안내를 보여준다', () => {
    render(<MessageBubble message={makeMessage({ status: 'cancelled' })} />);
    expect(screen.getByText('응답이 중단되었습니다.')).toBeInTheDocument();
  });

  it('발신자 이름과 시각 메타를 표시한다', () => {
    render(<MessageBubble message={makeMessage({ role: 'assistant' })} />);
    expect(screen.getByText('Vapor DS Agent')).toBeInTheDocument();

    render(<MessageBubble message={makeMessage({ role: 'user', text: '질문' })} />);
    expect(screen.getByText('나')).toBeInTheDocument();
  });

  it('첨부 파일 칩을 렌더링한다', () => {
    render(
      <MessageBubble
        message={makeMessage({
          role: 'user',
          text: '검토 부탁해',
          attachments: [{ fileName: 'draft.md', size: 2048 }],
        })}
      />,
    );
    expect(screen.getByText('draft.md')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('어시스턴트 응답을 마크다운으로 렌더링한다', () => {
    render(
      <MessageBubble
        message={makeMessage({
          role: 'assistant',
          text: '핵심은 **구조**입니다.\n\n- 첫째 항목\n- 둘째 항목',
        })}
      />,
    );
    expect(screen.getByText('구조').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('user 메시지는 마크다운이 아니라 평문으로 렌더링한다', () => {
    render(
      <MessageBubble
        message={makeMessage({ role: 'user', text: '**굵게** 안 됨' })}
      />,
    );
    // user 메시지는 평문이므로 strong 요소가 생기지 않는다.
    expect(screen.getByText('**굵게** 안 됨')).toBeInTheDocument();
  });
});
