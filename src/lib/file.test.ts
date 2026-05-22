import { describe, it, expect } from 'vitest';
import { formatBytes } from './file';

describe('formatBytes', () => {
  it('1024 미만은 바이트로 표시한다', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });

  it('KB / MB 단위로 변환한다', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
  });

  it('잘못된 입력은 - 로 표시한다', () => {
    expect(formatBytes(-1)).toBe('-');
    expect(formatBytes(Number.NaN)).toBe('-');
  });
});
