import { describe, expect, it } from 'vitest';
import { checkTokens } from './tokenRules.ts';

describe('checkTokens', () => {
  it('raw hex color #ff0000 → FAIL', () => {
    const result = checkTokens({ source: 'const x = "#ff0000";' });
    expect(result.status).toBe('FAIL');
    expect(result.evidence.some((e) => e.message.includes('hex'))).toBe(true);
  });

  it('raw hex shorthand #abc → FAIL', () => {
    const result = checkTokens({ source: 'color: "#abc"' });
    expect(result.status).toBe('FAIL');
  });

  it('rgb() function → FAIL', () => {
    const result = checkTokens({ source: 'background: rgb(255, 0, 0);' });
    expect(result.status).toBe('FAIL');
    expect(result.evidence.some((e) => e.message.includes('CSS color function'))).toBe(true);
  });

  it('hsl() function → FAIL', () => {
    const result = checkTokens({ source: 'color: hsl(120, 100%, 50%);' });
    expect(result.status).toBe('FAIL');
  });

  it('oklch() function → FAIL', () => {
    const result = checkTokens({ source: 'fill: oklch(70% 0.15 220);' });
    expect(result.status).toBe('FAIL');
  });

  it('Tailwind arbitrary spacing p-[16px] → WARN', () => {
    const result = checkTokens({ source: '<Box className="p-[16px]" />' });
    expect(result.status).toBe('WARN');
    expect(result.evidence.some((e) => e.message.includes('spacing'))).toBe(true);
  });

  it('Tailwind arbitrary spacing mt-[8px] → WARN', () => {
    const result = checkTokens({ source: '<div className="mt-[8px] mb-[4px]" />' });
    expect(result.status).toBe('WARN');
  });

  it('inline style padding: "16px" → WARN', () => {
    const result = checkTokens({ source: "style={{ padding: '16px' }}" });
    expect(result.status).toBe('WARN');
  });

  it('clean source with no raw values → PASS', () => {
    const result = checkTokens({
      source: "import { Button } from '@vapor-ui/core'; <Button className=\"p-v-4 bg-v-primary\" />",
    });
    expect(result.status).toBe('PASS');
    expect(result.evidence.some((e) => e.message.includes('No raw color'))).toBe(true);
  });

  it('hex color takes priority over spacing → FAIL (not WARN)', () => {
    const result = checkTokens({
      source: 'color: "#ff0000"; padding: "16px";',
    });
    expect(result.status).toBe('FAIL');
  });
});
