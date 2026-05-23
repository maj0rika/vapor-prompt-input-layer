import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepSeekAgentClient, parseDeepSeekSseFrame } from './DeepSeekAgentClient';
import type { AgentEvent } from './types';

async function collect(iterable: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('DeepSeekAgentClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('SSE token chunk 를 token 이벤트로 변환한다', () => {
    const events = parseDeepSeekSseFrame(
      'data: {"choices":[{"delta":{"content":"안녕"}}]}\n\n',
    );

    expect(events).toEqual([{ type: 'token', value: '안녕' }]);
  });

  it('[DONE] chunk 를 done 이벤트로 변환한다', () => {
    expect(parseDeepSeekSseFrame('data: [DONE]\n\n')).toEqual([{ type: 'done' }]);
  });

  it('malformed JSON chunk 는 error 이벤트로 변환한다', () => {
    expect(parseDeepSeekSseFrame('data: {broken}\n\n')).toEqual([
      { type: 'error', message: 'DeepSeek stream parse failed.' },
    ]);
  });

  it('프록시 error response 를 error 이벤트로 변환한다', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'DEEPSEEK_API_KEY is missing.' }), {
          status: 500,
        }),
      );
    const client = new DeepSeekAgentClient('/test');

    const events = await collect(client.sendMessage({ text: '안녕' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(events).toEqual([
      { type: 'error', message: 'DEEPSEEK_API_KEY is missing.' },
    ]);
  });

  it('stream response 를 기존 AgentEvent 계약으로 방출한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        streamFrom([
          'data: {"choices":[{"delta":{"content":"안"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"녕"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
        { status: 200 },
      ),
    );
    const client = new DeepSeekAgentClient('/test');

    const events = await collect(client.sendMessage({ text: '안녕' }));

    expect(events).toEqual([
      { type: 'token', value: '안' },
      { type: 'token', value: '녕' },
      { type: 'done' },
    ]);
  });

  it('artifact stream 완료 후 실제 validation 결과로 draft 를 교체한다', async () => {
    const artifact = `<artifact type="component" filename="PrimaryButton.tsx">
\`\`\`tsx
export function PrimaryButton() {
  return <button>Save</button>;
}
\`\`\`
</artifact>

<artifact type="story" filename="PrimaryButton.stories.tsx">
\`\`\`tsx
export const Default = {};
\`\`\`
</artifact>

<artifact type="test" filename="PrimaryButton.test.tsx">
\`\`\`tsx
expect(true).toBe(true);
\`\`\`
</artifact>

<notes type="a11y">
Uses a native button.
</notes>`;
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          streamFrom([
            `data: ${JSON.stringify({ choices: [{ delta: { content: artifact } }] })}\n\n`,
            'data: [DONE]\n\n',
          ]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'pass',
            durationMs: 123,
            details: [
              { label: 'Typecheck', status: 'pass', message: 'ok' },
              { label: 'Unit', status: 'pass', message: 'ok' },
              { label: 'Axe', status: 'pass', message: 'ok' },
              { label: 'Vapor token usage', status: 'pass', message: 'ok' },
            ],
          }),
          { status: 200 },
        ),
      );
    const client = new DeepSeekAgentClient('/chat', '/validate');

    const events = await collect(client.sendMessage({ text: '버튼 생성' }));
    const drafts = events.filter((event) => event.type === 'draft');

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/validate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ markdown: artifact }),
      }),
    );
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ type: 'draft' });
    expect(drafts[0]).not.toHaveProperty('replace');
    expect(drafts[1]).toMatchObject({ type: 'draft', replace: true });
    expect(drafts[1]?.value).toContain('- Typecheck: PASS');
    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('abort 시 done/error 없이 종료한다', async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      controller.abort();
      return new Response(streamFrom(['data: [DONE]\n\n']), { status: 200 });
    });
    const client = new DeepSeekAgentClient('/test');

    const events = await collect(
      client.sendMessage({ text: '멈춰' }, controller.signal),
    );

    expect(events).toEqual([]);
  });
});
