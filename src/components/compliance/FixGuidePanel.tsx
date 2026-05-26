import { Text } from '@vapor-ui/core';
import type { ComplianceGate } from './mockReport';

interface FixGuidePanelProps {
  fixGuide: ComplianceGate['fixGuide'];
}

/**
 * 수정 가이드 패널: 단계별 수정 지침 + Vapor 문서 링크.
 */
export function FixGuidePanel({ fixGuide }: FixGuidePanelProps) {
  const { steps, docLink } = fixGuide;

  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center py-v-400">
        <Text typography="body3" foreground="hint-200">
          수정 가이드가 필요 없습니다. ✓
        </Text>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-v-200">
      <ol className="flex flex-col gap-v-150" aria-label="수정 단계">
        {steps.map((s) => (
          <li
            key={s.step}
            className="flex items-start gap-v-150 rounded-v-200 border border-v-normal bg-v-canvas-100 p-v-200"
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-v-primary-100 text-xs font-bold text-v-primary"
              aria-hidden="true"
            >
              {s.step}
            </span>
            <Text typography="body3">{s.description}</Text>
          </li>
        ))}
      </ol>

      {docLink && (
        <div className="flex items-center gap-v-75 rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-200 py-v-150">
          <Text typography="body4" foreground="hint-200">
            📖 Vapor 문서:
          </Text>
          <a
            href={docLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-v-primary underline hover:text-v-primary-200"
            aria-label={`Vapor 공식 문서 열기: ${docLink}`}
          >
            {docLink}
          </a>
        </div>
      )}
    </div>
  );
}
