import { useEffect, useState } from 'react';

export type StreamingIndicatorProps = {
  /** 스트림이 시작된 시각 (epoch ms). 지정하면 경과 시간을 표시한다. */
  startedAt?: number;
  /** 단계 라벨. 'thinking'(첫 토큰 대기) | 'streaming'(응답 작성 중) */
  phase?: 'thinking' | 'streaming';
};

const PHASE_LABEL: Record<NonNullable<StreamingIndicatorProps['phase']>, string> = {
  thinking: '추론 중',
  streaming: '응답 작성 중',
};

/**
 * 어시스턴트 응답 생성 중 인디케이터.
 *
 * `startedAt` 이 있으면 경과 시간(소수점 1자리)을 함께 표시해 사용자가
 * "지금 얼마나 기다리고 있는지" 시각적으로 인지하게 한다.
 */
export function StreamingIndicator({
  startedAt,
  phase = 'thinking',
}: StreamingIndicatorProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const tick = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(tick);
  }, [startedAt]);

  const elapsedSec = startedAt ? Math.max(0, (now - startedAt) / 1000) : null;

  return (
    <span
      role="status"
      aria-label="응답 생성 중"
      className="inline-flex items-center gap-v-100 py-v-50"
    >
      <span className="inline-flex items-center gap-v-50" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-v-hint-200"
            style={{ animationDelay: `${index * 0.15}s` }}
          />
        ))}
      </span>
      {elapsedSec != null && (
        <span
          className="text-xs tabular-nums"
          style={{ color: 'var(--vapor-color-foreground-hint-200)' }}
        >
          {PHASE_LABEL[phase]} · {elapsedSec.toFixed(1)}초
        </span>
      )}
    </span>
  );
}
