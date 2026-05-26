/**
 * 보수 응답 표시용 라이트웨이트 line-diff 요약.
 *
 * 정확한 LCS 대신 line set 기반으로 "얼마나 달라졌나" 만 보여준다.
 * 순서 변경은 잡지 못하지만 사용자가 "변경 규모" 를 즉시 인지하기엔 충분.
 */
export type DiffSummary = {
  added: number;
  removed: number;
};

export function summarizeLineDiff(prev: string, next: string): DiffSummary {
  if (!prev || !next || prev === next) return { added: 0, removed: 0 };
  const prevLines = new Set(prev.split('\n').filter((line) => line.length > 0));
  const nextLines = new Set(next.split('\n').filter((line) => line.length > 0));
  let added = 0;
  let removed = 0;
  for (const line of nextLines) if (!prevLines.has(line)) added += 1;
  for (const line of prevLines) if (!nextLines.has(line)) removed += 1;
  return { added, removed };
}
