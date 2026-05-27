import { describe, expect, it } from 'vitest';
import { checkVaporComponents } from './vaporComponentRules';

function src(content: string) {
  return { fileSources: [{ path: 'test.tsx', content }] };
}

describe('checkVaporComponents — case-sensitivity', () => {
  it('does NOT count Vapor <Button> as native <button>', () => {
    const source = `
      import { Button } from '@vapor-ui/core';
      function X() { return <Button>OK</Button>; }
    `;
    const gate = checkVaporComponents(src(source));
    const flagged = gate.evidence.find((e) => e.message.toLowerCase().includes('native'));
    expect(flagged).toBeUndefined();
    expect(gate.status).toBe('PASS');
  });

  it('does NOT count Vapor <Input> as native <input>', () => {
    const source = `
      import { Input } from '@vapor-ui/core';
      function X() { return <Input value="" />; }
    `;
    const gate = checkVaporComponents(src(source));
    const flagged = gate.evidence.find((e) => e.message.toLowerCase().includes('native'));
    expect(flagged).toBeUndefined();
    expect(gate.status).toBe('PASS');
  });

  it('counts native <button> (lowercase) correctly', () => {
    const source = `
      import { Button } from '@vapor-ui/core';
      function X() {
        return <button onClick={() => {}}>raw</button>;
      }
    `;
    const gate = checkVaporComponents(src(source));
    const flagged = gate.evidence.find((e) => e.message.toLowerCase().includes('native'));
    expect(flagged?.message).toContain('button');
    expect(gate.status).toBe('FAIL');
  });

  it('flags IconButton without aria-label', () => {
    const source = `<IconButton onClick={() => {}}>X</IconButton>`;
    const gate = checkVaporComponents(src(
      `import { IconButton } from '@vapor-ui/core'; ${source}`,
    ));
    const flagged = gate.evidence.find((e) => e.message.includes('IconButton'));
    expect(flagged?.message).toContain('missing');
  });

  it('passes IconButton with aria-label', () => {
    const source = `
      import { IconButton } from '@vapor-ui/core';
      <IconButton aria-label="닫기">X</IconButton>
    `;
    const gate = checkVaporComponents(src(source));
    const flagged = gate.evidence.find((e) => e.message.includes('IconButton'));
    expect(flagged).toBeUndefined();
  });
});
