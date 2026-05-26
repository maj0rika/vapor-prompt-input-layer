import { describe, expect, it } from 'vitest';
import { summarizeLineDiff } from './repairSummary';

describe('summarizeLineDiff', () => {
  it('동일한 source 는 0/0 으로 보고한다', () => {
    expect(summarizeLineDiff('a\nb\nc', 'a\nb\nc')).toEqual({
      added: 0,
      removed: 0,
    });
  });

  it('빈 source 는 0/0', () => {
    expect(summarizeLineDiff('', '')).toEqual({ added: 0, removed: 0 });
    expect(summarizeLineDiff('a', '')).toEqual({ added: 0, removed: 0 });
    expect(summarizeLineDiff('', 'a')).toEqual({ added: 0, removed: 0 });
  });

  it('added/removed line 수를 보고한다', () => {
    const prev = 'line A\nline B\nline C';
    const next = 'line A\nline X\nline Y';
    expect(summarizeLineDiff(prev, next)).toEqual({ added: 2, removed: 2 });
  });

  it('빈 줄은 무시한다', () => {
    expect(summarizeLineDiff('a\n\n\nb', 'a\nb')).toEqual({
      added: 0,
      removed: 0,
    });
  });
});
