import { Text } from '@vapor-ui/core';
import type { Evidence } from './mockReport';

interface EvidencePanelProps {
  evidence: Evidence[];
}

/**
 * 증거 목록 패널: file:line + 코드 스니펫을 표시한다.
 */
export function EvidencePanel({ evidence }: EvidencePanelProps) {
  if (evidence.length === 0) {
    return (
      <div className="flex items-center justify-center py-v-400">
        <Text typography="body3" foreground="hint-200">
          이슈가 없습니다. ✓
        </Text>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-v-150" aria-label="이슈 증거 목록">
      {evidence.map((ev, i) => (
        <li
          key={`${ev.file}:${ev.line}:${i}`}
          className="flex flex-col gap-v-75 rounded-v-200 border border-v-normal bg-v-canvas-200 p-v-200"
        >
          <div className="flex items-center gap-v-100 overflow-x-auto">
            <span
              className="shrink-0 rounded-v-100 bg-v-canvas-300 px-v-100 py-v-50 font-mono text-xs text-v-hint"
            >
              {ev.file}
            </span>
            <span
              className="shrink-0 rounded-v-100 border border-v-normal px-v-100 py-v-50 font-mono text-xs text-v-hint"
            >
              L{ev.line}
            </span>
          </div>
          <pre className="overflow-x-auto rounded-v-100 bg-v-canvas-100 p-v-150 text-xs">
            <code className="font-mono text-v-foreground-normal">{ev.snippet}</code>
          </pre>
        </li>
      ))}
    </ul>
  );
}
