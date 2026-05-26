import { describe, expect, it } from 'vitest';
import { buildDeepSeekPayload, buildUserContent } from './promptBuilder';

describe('promptBuilder', () => {
  it('DS automation system prompt 와 artifact delimiter 지시를 포함한다', () => {
    const payload = buildDeepSeekPayload({
      text: 'primary 버튼 생성',
      mode: 'component',
    });

    expect(payload.messages[0].content).toContain(
      'AI Design System Automation Agent',
    );
    expect(payload.messages[0].content).toContain(
      '<artifact type="component"',
    );
    expect(payload.messages[0].content).toContain('<artifact-meta>');
    expect(payload.messages[0].content).toContain('primaryExport');
    expect(payload.messages[0].content).toContain('untrusted reference material');
  });

  it('mode 와 attachment text 를 user content 에 포함한다', () => {
    const content = buildUserContent({
      text: '토큰 매핑해줘',
      mode: 'token-sync',
      attachments: [
        {
          fileName: 'tokens.json',
          size: 120,
          kind: 'tokens',
          contentText: '{"color.primary.500":"#0066ff"}',
          truncated: false,
        },
      ],
    });

    expect(content).toContain('Mode: token-sync');
    expect(content).toContain('<artifact-meta>');
    expect(content).toContain('[tokens.json]');
    expect(content).toContain('full text included');
    expect(content).toContain('color.primary.500');
  });

  // Phase A — repair context 반영 테스트 (RED)
  it('repair 요청 시 previousArtifactSource 를 user content 에 포함한다', () => {
    const content = buildUserContent({
      text: '수정해줘',
      mode: 'component',
      previousArtifactSource: '<artifact type="component" filename="Foo.tsx">```tsx\nexport function Foo(){}\n```</artifact>',
      repairIntent: { failedGates: ['token'], maxAttempts: 1 },
    });

    expect(content).toContain('Repair context');
    expect(content).toContain('previousArtifactSource');
    expect(content).toContain('export function Foo');
  });

  it('repair 요청 시 validationResult.failedGates 를 user content 에 포함한다', () => {
    const content = buildUserContent({
      text: '수정해줘',
      mode: 'component',
      previousArtifactSource: '<artifact type="component" filename="Foo.tsx">```tsx\nexport function Foo(){}\n```</artifact>',
      validationResult: {
        status: 'fail',
        durationMs: 100,
        details: [
          { label: 'Vapor token usage', status: 'fail', message: 'raw color detected' },
          { label: 'Typecheck', status: 'pass', message: 'ok' },
        ],
      },
      repairIntent: { failedGates: ['token'], maxAttempts: 1 },
    });

    expect(content).toContain('token');
    expect(content).toContain('Vapor token usage');
  });

  it('repair 요청 시 각 failed gate 의 runner output 요약을 user content 에 포함한다', () => {
    const content = buildUserContent({
      text: '수정해줘',
      mode: 'component',
      previousArtifactSource: '<artifact type="component" filename="Foo.tsx">```tsx\nexport function Foo(){}\n```</artifact>',
      validationResult: {
        status: 'fail',
        durationMs: 100,
        details: [
          { label: 'Vapor token usage', status: 'fail', message: 'raw color detected', output: 'Found: color: #ff0000' },
        ],
      },
      repairIntent: { failedGates: ['token'], maxAttempts: 1 },
    });

    expect(content).toContain('Found: color: #ff0000');
  });

  it('repair 요청 시 실패 gate 만 수정하라는 지시가 prompt 에 포함된다', () => {
    const content = buildUserContent({
      text: '수정해줘',
      mode: 'component',
      previousArtifactSource: '<artifact type="component" filename="Foo.tsx">```tsx\nexport function Foo(){}\n```</artifact>',
      repairIntent: { failedGates: ['token', 'axe'], maxAttempts: 1 },
    });

    expect(content).toContain('실패한 gate만');
    expect(content).toContain('전체 artifact');
  });
});

describe('buildDeepSeekPayload — 멀티턴', () => {
  it('priorTurns 가 없으면 system + 단일 user 메시지만 생성한다', () => {
    const payload = buildDeepSeekPayload({ text: '안녕' });
    expect(payload.messages).toHaveLength(2);
    expect(payload.messages[0].role).toBe('system');
    expect(payload.messages[1].role).toBe('user');
  });

  it('priorTurns 를 system 다음에 시간순으로 끼워 넣는다', () => {
    const payload = buildDeepSeekPayload({
      text: '이번엔 dark mode 도 지원해줘',
      priorTurns: [
        { role: 'user', content: 'primary 버튼 만들어줘' },
        { role: 'assistant', content: 'PrimaryButton.tsx 만들었습니다' },
      ],
    });
    expect(payload.messages).toHaveLength(4);
    expect(payload.messages[0].role).toBe('system');
    expect(payload.messages[1]).toEqual({
      role: 'user',
      content: 'primary 버튼 만들어줘',
    });
    expect(payload.messages[2]).toEqual({
      role: 'assistant',
      content: 'PrimaryButton.tsx 만들었습니다',
    });
    expect(payload.messages[3].role).toBe('user');
    expect(payload.messages[3].content).toContain('dark mode');
  });

  it('priorTurns 가 cap 을 초과하면 가장 최근 turn 만 유지한다', () => {
    const lots = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `turn-${i}`,
    }));
    const payload = buildDeepSeekPayload({ text: 'last', priorTurns: lots });
    // system + (<=20 priors) + last user
    expect(payload.messages.length).toBeLessThanOrEqual(1 + 20 + 1);
    expect(payload.messages.find((m) => m.content === 'turn-0')).toBeUndefined();
    expect(payload.messages.some((m) => m.content === 'turn-29')).toBe(true);
  });

  it('아주 긴 turn 은 잘라서 토큰 폭주를 막는다', () => {
    const huge = 'x'.repeat(20 * 1024);
    const payload = buildDeepSeekPayload({
      text: '계속해줘',
      priorTurns: [{ role: 'assistant', content: huge }],
    });
    const turn = payload.messages.find((m) => m.role === 'assistant');
    expect(turn?.content.length).toBeLessThan(huge.length);
    expect(turn?.content).toContain('(truncated)');
  });
});
