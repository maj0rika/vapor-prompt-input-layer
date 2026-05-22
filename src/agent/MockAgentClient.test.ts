import { describe, it, expect } from 'vitest';
import { MockAgentClient } from './MockAgentClient';
import type { AgentEvent } from './types';

async function collect(
  iterable: AsyncIterable<AgentEvent>,
  onEach?: (event: AgentEvent, index: number) => void,
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of iterable) {
    onEach?.(event, events.length);
    events.push(event);
  }
  return events;
}

describe('MockAgentClient', () => {
  it('본문 토큰을 순서대로 방출하고 done 으로 종료한다', async () => {
    const client = new MockAgentClient();
    const events = await collect(client.sendMessage({ text: '제목 추천해줘' }));

    expect(events.length).toBeGreaterThan(1);
    expect(events[events.length - 1]).toEqual({ type: 'done' });

    const tokens = events.filter((e) => e.type === 'token');
    expect(tokens.length).toBeGreaterThan(0);
    const reply = tokens.map((e) => (e.type === 'token' ? e.value : '')).join('');
    expect(reply.length).toBeGreaterThan(0);
  });

  it('초안이 있는 스크립트는 draft 이벤트를 방출한다', async () => {
    const client = new MockAgentClient();
    const events = await collect(client.sendMessage({ text: '이 문장 다듬어줘' }));

    expect(events.some((e) => e.type === 'draft')).toBe(true);
    expect(events[events.length - 1]).toEqual({ type: 'done' });
  });

  it('오류 스크립트는 error 로 종료하고 done 을 방출하지 않는다', async () => {
    const client = new MockAgentClient();
    const events = await collect(client.sendMessage({ text: '에러 재현' }));

    const last = events[events.length - 1];
    expect(last.type).toBe('error');
    expect(events.some((e) => e.type === 'done')).toBe(false);
  });

  it('abort 시 스트림을 즉시 중단하고 done/error 를 방출하지 않는다', async () => {
    const client = new MockAgentClient();
    const controller = new AbortController();

    const events = await collect(
      client.sendMessage({ text: '초안 써줘' }, controller.signal),
      (_event, index) => {
        // 첫 토큰을 받자마자 취소한다.
        if (index === 0) controller.abort();
      },
    );

    expect(events.some((e) => e.type === 'done')).toBe(false);
    expect(events.some((e) => e.type === 'error')).toBe(false);
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('시작 전에 이미 aborted 면 아무 이벤트도 방출하지 않는다', async () => {
    const client = new MockAgentClient();
    const controller = new AbortController();
    controller.abort();

    const events = await collect(
      client.sendMessage({ text: '초안 써줘' }, controller.signal),
    );

    expect(events).toHaveLength(0);
  });
});
