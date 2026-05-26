import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../agent';
import { MessageBubble } from './MessageBubble';

export type ConversationViewProps = {
  messages: ChatMessage[];
  /** 어시스턴트 메시지 재생성 (assistant 메시지 id 전달). */
  onRegenerate: (assistantId: string) => void;
};

/**
 * `prefers-reduced-motion: reduce` 사용자에게는 smooth scroll 을 즉시 jump
 * 로 다운그레이드한다. matchMedia 가 없는 SSR/jsdom 환경에서는 안전하게
 * smooth 를 기본값으로 둔다.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

/**
 * 메시지 thread 스크롤 컨테이너. 새 메시지가 추가되면 하단으로 스크롤한다.
 */
export function ConversationView({
  messages,
  onRegenerate,
}: ConversationViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    endRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'end' });
  }, [messages]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    const isNearBottom = distanceFromBottom < 64;
    stickToBottomRef.current = isNearBottom;
    setShowJumpToLatest(!isNearBottom);
  };

  const scrollToLatest = () => {
    stickToBottomRef.current = true;
    setShowJumpToLatest(false);
    endRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'end' });
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        role="log"
        aria-label="대화 내용"
        aria-live="polite"
        onScroll={handleScroll}
        className="flex h-full min-h-0 flex-col gap-v-150 overflow-y-auto overflow-x-hidden p-v-200"
      >
        {messages.map((message, index) => {
          // 보수 응답 diff 요약용: 자기 자신 이전의 가장 가까운 assistant
          // 메시지의 artifactSource 를 찾는다.
          let prevAssistantArtifactSource: string | undefined;
          if (message.role === 'assistant' && message.artifactSource) {
            for (let j = index - 1; j >= 0; j -= 1) {
              const earlier = messages[j];
              if (earlier.role === 'assistant' && earlier.artifactSource) {
                prevAssistantArtifactSource = earlier.artifactSource;
                break;
              }
            }
          }
          return (
            <MessageBubble
              key={message.id}
              message={message}
              prevAssistantArtifactSource={prevAssistantArtifactSource}
              onRegenerate={
                message.role === 'assistant' &&
                message.artifactProvenance !== 'deterministic-sample'
                  ? () => onRegenerate(message.id)
                  : undefined
              }
            />
          );
        })}
        <div ref={endRef} />
      </div>
      {showJumpToLatest && (
        <button
          type="button"
          className="absolute bottom-v-200 right-v-200 rounded-v-300 border border-v-normal bg-v-canvas-100 px-v-200 py-v-100 text-sm shadow-sm"
          onClick={scrollToLatest}
        >
          최신으로 이동
        </button>
      )}
    </div>
  );
}
