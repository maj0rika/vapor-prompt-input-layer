import { describe, expect, it } from 'vitest';
import { checkTokens } from './tokenRules.ts';

function src(content: string) {
  return { fileSources: [{ path: 'test.tsx', content }] };
}

describe('checkTokens', () => {
  it('raw hex color #ff0000 → FAIL + location', () => {
    const result = checkTokens(src('const x = "#ff0000";'));
    expect(result.status).toBe('FAIL');
    expect(result.evidence[0].location).toBe('test.tsx:1');
    expect(result.evidence[0].message).toContain('#ff0000');
  });

  it('raw hex shorthand #abc → FAIL', () => {
    const result = checkTokens(src('color: "#abc"'));
    expect(result.status).toBe('FAIL');
  });

  it('rgb() function → FAIL + location', () => {
    const result = checkTokens(src('background: rgb(255, 0, 0);'));
    expect(result.status).toBe('FAIL');
    expect(result.evidence.some((e) => e.message.includes('CSS color function'))).toBe(true);
  });

  it('hsl() function → FAIL', () => {
    const result = checkTokens(src('color: hsl(120, 100%, 50%);'));
    expect(result.status).toBe('FAIL');
  });

  it('oklch() function → FAIL', () => {
    const result = checkTokens(src('fill: oklch(70% 0.15 220);'));
    expect(result.status).toBe('FAIL');
  });

  it('Tailwind arbitrary spacing p-[16px] → WARN', () => {
    const result = checkTokens(src('<Box className="p-[16px]" />'));
    expect(result.status).toBe('WARN');
    expect(result.evidence.some((e) => e.message.includes('spacing'))).toBe(true);
  });

  it('Tailwind arbitrary spacing mt-[8px] → WARN', () => {
    const result = checkTokens(src('<div className="mt-[8px] mb-[4px]" />'));
    expect(result.status).toBe('WARN');
  });

  it('inline style padding: "16px" → WARN', () => {
    const result = checkTokens(src("style={{ padding: '16px' }}"));
    expect(result.status).toBe('WARN');
  });

  it('clean source with no raw values → PASS', () => {
    const result = checkTokens(src(`import { Button } from '@vapor-ui/core'; <Button className="p-v-4 bg-v-primary" />`));
    expect(result.status).toBe('PASS');
    expect(result.evidence.some((e) => e.message.includes('No raw color'))).toBe(true);
  });

  it('hex color takes priority over spacing → FAIL (not WARN)', () => {
    const result = checkTokens(src('color: "#ff0000"; padding: "16px";'));
    expect(result.status).toBe('FAIL');
  });
});
