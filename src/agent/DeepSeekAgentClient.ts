import type { AgentClient } from './AgentClient';
import type { AgentEvent, AgentRequest } from './types';
import { artifactToMarkdown, parseGeneratedArtifact } from './responseParser';
import { checkTokenUsage } from './tokenUsage';

type DeepSeekDelta = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
    finish_reason?: string | null;
  }>;
};

export function parseDeepSeekSseFrame(frame: string): AgentEvent[] {
  const events: AgentEvent[] = [];
  const dataLines = frame
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim());

  for (const data of dataLines) {
    if (!data) continue;
    if (data === '[DONE]') {
      events.push({ type: 'done' });
      continue;
    }

    try {
      const payload = JSON.parse(data) as DeepSeekDelta;
      const choice = payload.choices?.[0];
      const content = choice?.delta?.content;
      if (content) events.push({ type: 'token', value: content });
      if (choice?.finish_reason) events.push({ type: 'done' });
    } catch {
      events.push({ type: 'error', message: 'DeepSeek stream parse failed.' });
    }
  }

  return events;
}

async function* parseDeepSeekStream(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncIterable<AgentEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        for (const event of parseDeepSeekSseFrame(frame)) {
          if (signal?.aborted) return;
          yield event;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const event of parseDeepSeekSseFrame(buffer)) {
        if (signal?.aborted) return;
        yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 브라우저용 DeepSeek 클라이언트.
 *
 * API 키는 Vite 서버 프록시가 보관한다. 이 클라이언트는 same-origin
 * endpoint 로 AgentRequest 만 보내고, DeepSeek SSE chunk 를 AgentEvent 로
 * 변환한다.
 */
export class DeepSeekAgentClient implements AgentClient {
  private readonly endpoint: string;
  private readonly validationEndpoint: string;

  constructor(endpoint = '/api/deepseek/chat', validationEndpoint = '/api/deepseek/validate') {
    this.endpoint = endpoint;
    this.validationEndpoint = validationEndpoint;
  }

  async *sendMessage(
    request: AgentRequest,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal,
      });

      if (!response.ok) {
        const message = await readErrorMessage(response);
        yield { type: 'error', message };
        return;
      }

      if (!response.body) {
        yield { type: 'error', message: 'DeepSeek stream is empty.' };
        return;
      }

      let responseText = '';
      let emittedDone = false;
      for await (const event of parseDeepSeekStream(response.body, signal)) {
        if (event.type === 'token') {
          responseText += event.value;
          yield event;
        } else if (event.type === 'done') {
          emittedDone = true;
          yield* this.buildDraftEvents(responseText, signal);
          yield event;
        } else {
          yield event;
        }
      }

      if (!signal?.aborted && !emittedDone) {
        yield* this.buildDraftEvents(responseText, signal);
        yield { type: 'done' };
      }
    } catch (err) {
      if (signal?.aborted || isAbortError(err)) return;
      yield {
        type: 'error',
        message: err instanceof Error ? err.message : 'DeepSeek request failed.',
      };
    }
  }

  private async *buildDraftEvents(
    responseText: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    const preview = buildPreviewArtifact(responseText);
    if (!preview || signal?.aborted) return;

    yield { type: 'draft', value: preview };

    const validated = await applyRemoteValidation(
      preview,
      responseText,
      this.validationEndpoint,
      signal,
    );
    if (!validated || signal?.aborted) return;
    yield { type: 'draft', value: validated, replace: true };
  }
}

function buildPreviewArtifact(responseText: string): string {
  const artifact = parseGeneratedArtifact(responseText);
  if (!artifact.component && !artifact.story && !artifact.test) return '';
  const tokenCheck = checkTokenUsage(artifact);
  return artifactToMarkdown(artifact).replace(
    '- Vapor token usage: CHECK',
    `- Vapor token usage: ${tokenCheck.status === 'pass' ? 'PASS' : 'CHECK'}`,
  );
}

type RemoteValidationResult = {
  status: 'pass' | 'warn' | 'fail';
  durationMs: number;
  details: Array<{
    label: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
    durationMs?: number;
  }>;
};

async function applyRemoteValidation(
  preview: string,
  responseText: string,
  endpoint: string,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: responseText }),
      signal,
    });
    if (!response.ok) {
      return replaceValidationSection(preview, [
        '- Typecheck: CHECK',
        '- Unit: CHECK',
        '- Axe: CHECK',
        '- Vapor token usage: CHECK',
        '',
        `### Validation runner`,
        `Generated validation failed (${response.status}).`,
      ]);
    }

    const result = (await response.json()) as RemoteValidationResult;
    return replaceValidationSection(preview, validationResultLines(result));
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) return '';
    return replaceValidationSection(preview, [
      '- Typecheck: CHECK',
      '- Unit: CHECK',
      '- Axe: CHECK',
      '- Vapor token usage: CHECK',
      '',
      '### Validation runner',
      error instanceof Error ? error.message : 'Generated validation failed.',
    ]);
  }
}

function validationResultLines(result: RemoteValidationResult): string[] {
  const detailsByLabel = new Map(result.details.map((detail) => [detail.label, detail]));
  const labels = ['Typecheck', 'Unit', 'Axe', 'Vapor token usage'];
  const lines = labels.map((label) => {
    const detail = detailsByLabel.get(label);
    const status = detail?.status === 'pass' ? 'PASS' : detail?.status === 'fail' ? 'FAIL' : 'CHECK';
    return `- ${label}: ${status}`;
  });

  lines.push('', '### Runner details');
  for (const detail of result.details) {
    const duration = detail.durationMs ? ` (${detail.durationMs}ms)` : '';
    lines.push(`- ${detail.label}: ${detail.status.toUpperCase()}${duration} - ${detail.message}`);
  }
  lines.push(`- Duration: ${result.durationMs}ms`);
  return lines;
}

function replaceValidationSection(preview: string, lines: string[]): string {
  if (!preview.includes('## Validation')) {
    return `${preview}\n\n## Validation\n\n${lines.join('\n')}`;
  }
  return preview.replace(/## Validation[\s\S]*$/m, `## Validation\n\n${lines.join('\n')}`);
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `DeepSeek request failed (${response.status}).`;
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}
