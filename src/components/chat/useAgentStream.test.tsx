import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAgentStream } from './useAgentStream';
import { MockAgentClient } from '../../agent';
import type { AgentClient, AgentEvent } from '../../agent';

/**
 * 취소될 때까지 토큰을 무한히 흘리는 테스트용 클라이언트.
 * teardown 검증을 위해 signal 을 동기적으로 캡처한다.
 */
class SpyAgentClient implements AgentClient {
  lastSignal?: AbortSignal;

  sendMessage(_request: unknown, signal?: AbortSignal): AsyncIterable<AgentEvent> {
    this.lastSignal = signal;
    return this.#stream(signal);
  }

  async *#stream(signal?: AbortSignal): AsyncIterable<AgentEvent> {
    for (let i = 0; i < 1000; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (signal?.aborted) return;
      yield { type: 'token', value: 'x' };
    }
    yield { type: 'done' };
  }
}

class DraftReplaceClient implements AgentClient {
  async *sendMessage(): AsyncIterable<AgentEvent> {
    yield { type: 'draft', value: 'pending' };
    yield { type: 'draft', value: 'validated', replace: true };
    yield { type: 'done' };
  }
}

function Harness({ client }: { client: AgentClient }) {
  const { messages, isStreaming, send, cancel } = useAgentStream(client);
  const assistant = messages.find((m) => m.role === 'assistant');
  return (
    <div>
      <button onClick={() => send({ text: '안녕' })}>send</button>
      <button onClick={cancel}>cancel</button>
      <span data-testid="streaming">{String(isStreaming)}</span>
      <span data-testid="count">{messages.length}</span>
      <span data-testid="assistant-status">{assistant?.status ?? 'none'}</span>
      <span data-testid="assistant-text">{assistant?.text ?? ''}</span>
      <span data-testid="assistant-draft">{assistant?.draft ?? ''}</span>
    </div>
  );
}

describe('useAgentStream', () => {
  it('send 시 user + assistant 메시지를 추가하고 응답을 스트리밍한다', async () => {
    render(<Harness client={new MockAgentClient()} />);
    fireEvent.click(screen.getByText('send'));

    expect(screen.getByTestId('count')).toHaveTextContent('2');

    await waitFor(
      () =>
        expect(screen.getByTestId('assistant-status')).toHaveTextContent('done'),
      { timeout: 4000 },
    );
    expect(screen.getByTestId('assistant-text').textContent?.length).toBeGreaterThan(
      0,
    );
  });

  it('cancel 시 어시스턴트 메시지가 cancelled 로 전이한다', async () => {
    render(<Harness client={new SpyAgentClient()} />);
    fireEvent.click(screen.getByText('send'));
    await waitFor(() =>
      expect(screen.getByTestId('streaming')).toHaveTextContent('true'),
    );

    fireEvent.click(screen.getByText('cancel'));
    await waitFor(() =>
      expect(screen.getByTestId('assistant-status')).toHaveTextContent(
        'cancelled',
      ),
    );
  });

  it('언마운트 시 진행 중인 스트림의 AbortSignal 을 abort 한다 (teardown 계약)', async () => {
    const client = new SpyAgentClient();
    const { unmount } = render(<Harness client={client} />);

    fireEvent.click(screen.getByText('send'));
    expect(client.lastSignal).toBeDefined();
    expect(client.lastSignal?.aborted).toBe(false);

    unmount();

    expect(client.lastSignal?.aborted).toBe(true);
  });

  it('언마운트 후에는 추가 렌더 오류 없이 스트림이 정리된다', async () => {
    const client = new SpyAgentClient();
    const { unmount } = render(<Harness client={client} />);
    fireEvent.click(screen.getByText('send'));
    unmount();
    // 언마운트 후 남은 타이머가 흘러도 오류가 없어야 한다.
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(client.lastSignal?.aborted).toBe(true);
  });

  it('replace draft 이벤트는 기존 artifact preview 를 교체한다', async () => {
    render(<Harness client={new DraftReplaceClient()} />);

    fireEvent.click(screen.getByText('send'));

    await waitFor(() =>
      expect(screen.getByTestId('assistant-status')).toHaveTextContent('done'),
    );
    expect(screen.getByTestId('assistant-draft')).toHaveTextContent('validated');
    expect(screen.getByTestId('assistant-draft')).not.toHaveTextContent(
      'pendingvalidated',
    );
  });
});
