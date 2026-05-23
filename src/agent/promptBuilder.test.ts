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
});
