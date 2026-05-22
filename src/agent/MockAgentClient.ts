import type { AgentClient } from './AgentClient';
import type { AgentEvent, AgentRequest } from './types';
import { selectScript } from './scripts';
import { artifactToMarkdown, parseGeneratedArtifact } from './responseParser';
import { checkTokenUsage } from './tokenUsage';

/** 토큰 사이 지연(ms). SSE 스트리밍을 흉내 낸다. */
const TOKEN_DELAY_MS = 6;

/** 본문을 단어+공백 단위 토큰으로 쪼갠다. */
function tokenize(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [];
}

/** abort 가능한 지연. abort 시 AbortError 로 reject 한다. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

/**
 * 모의 스트리밍 에이전트 클라이언트.
 *
 * 입력 키워드로 스크립트를 선택해 토큰 단위로 지연 방출한다.
 * `AgentClient` 인터페이스를 구현하므로 실제 백엔드 클라이언트로 교체 가능.
 */
export class MockAgentClient implements AgentClient {
  async *sendMessage(
    request: AgentRequest,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    const script = selectScript(request.text, request.mode);

    try {
      for (const token of tokenize(script.reply)) {
        await delay(TOKEN_DELAY_MS, signal);
        yield { type: 'token', value: token };
      }

      if (script.error) {
        yield { type: 'error', message: script.error };
        return;
      }

      if (script.draft) {
        const artifact = parseGeneratedArtifact(script.draft);
        const tokenCheck = checkTokenUsage(artifact);
        const preview = artifactToMarkdown(artifact)
          .replace(
            '- Vapor token usage: CHECK',
            `- Vapor token usage: ${tokenCheck.status === 'pass' ? 'PASS' : 'CHECK'}`,
          )
          .replace('- Typecheck: CHECK', '- Typecheck: PASS')
          .replace('- Unit: CHECK', '- Unit: PASS')
          .replace('- Axe: CHECK', '- Axe: PASS');
        for (const token of tokenize(preview)) {
          await delay(TOKEN_DELAY_MS, signal);
          yield { type: 'draft', value: token };
        }
      }

      yield { type: 'done' };
    } catch (err) {
      // abort 는 정상적인 취소 경로 — 조용히 이터레이터를 종료한다.
      // 소비자는 signal.aborted 를 확인해 'cancelled' 로 전이한다.
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      throw err;
    }
  }
}
