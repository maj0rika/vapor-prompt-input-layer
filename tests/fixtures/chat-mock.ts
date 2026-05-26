import type { Page, Route } from '@playwright/test';
import { selectScript, selectScriptByTemplateKey, type TemplateKey } from '../../src/agent/scripts';
import type { AgentMode } from '../../src/agent/types';

/**
 * Playwright fixture: /api/deepseek/chat 를 deterministic SSE response 로
 * 가로채 자연어 E2E 가 DEEPSEEK_API_KEY 없이도 동일한 artifact 를 얻도록 한다.
 *
 * validation runner (/api/deepseek/validate) 는 가로채지 않는다 — 실제
 * 로컬 runner 가 빌드/테스트/접근성/토큰 게이트를 실행해야 한다.
 */

type RouteOptions = {
  /** 모드 강제. 생략 시 request body 의 mode 사용. */
  mode?: AgentMode;
  /** 자연어 매칭 무시하고 templateKey 의 고정 artifact 를 반환. */
  templateKey?: TemplateKey;
  /** 추가 prose. 생략 시 selectScript 의 reply 를 그대로 emit. */
  replyOverride?: string;
  /**
   * selectScript 우회: 임의 artifact (artifact-meta + artifact 태그 포함)
   * 를 그대로 SSE 본문으로 emit. 실 DeepSeek 의 특수 패턴 (export
   * default Identifier, ```json fence 등) 회귀를 재현할 때 사용한다.
   */
  artifactOverride?: string;
};

function toSseFrame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

function buildSseBody(reply: string, artifact: string | undefined): string {
  // 1) prose 청크 (사용자가 보는 conversation bubble), 2) artifact 청크,
  // 3) [DONE]. DeepSeekAgentClient 는 frame 단위로 split 하므로 한 응답에
  // 직렬로 묶어도 client 가 정상 stream 으로 인식한다.
  const chunks: string[] = [];
  if (reply) chunks.push(toSseFrame(reply));
  if (artifact) chunks.push(toSseFrame(`\n\n${artifact}`));
  chunks.push('data: [DONE]\n\n');
  return chunks.join('');
}

async function fulfillSse(route: Route, body: string): Promise<void> {
  await route.fulfill({
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
    },
    body,
  });
}

/**
 * `page.route('**\/api/deepseek/chat', handler)` 를 등록한다. 모든 chat
 * 요청은 selectScript 로 결정된 deterministic artifact 로 응답된다.
 */
export async function mockDeepSeekChat(page: Page, options: RouteOptions = {}): Promise<void> {
  await page.route('**/api/deepseek/chat', async (route) => {
    try {
      const raw = route.request().postData() ?? '{}';
      const request = JSON.parse(raw) as { text?: string; mode?: AgentMode };
      const mode = options.mode ?? request.mode ?? 'component';
      const script = options.templateKey
        ? selectScriptByTemplateKey(options.templateKey)
        : selectScript(request.text ?? '', mode);
      const reply = options.replyOverride ?? script.reply;
      const artifact = options.artifactOverride ?? script.draft;
      await fulfillSse(route, buildSseBody(reply, artifact));
    } catch (err) {
      await route.fulfill({
        status: 500,
        body: err instanceof Error ? err.message : 'chat mock failed',
      });
    }
  });
}
