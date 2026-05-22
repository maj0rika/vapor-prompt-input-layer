import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../agent';
import { MessageBubble } from './MessageBubble';

export type ConversationViewProps = {
  messages: ChatMessage[];
  /** 어시스턴트 메시지 재생성 (assistant 메시지 id 전달). */
  onRegenerate: (assistantId: string) => void;
};

/**
 * 메시지 thread 스크롤 컨테이너. 새 메시지가 추가되면 하단으로 스크롤한다.
 */
export function ConversationView({
  messages,
  onRegenerate,
}: ConversationViewProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  return (
    <div
      role="log"
      aria-label="대화 내용"
      aria-live="polite"
      className="flex flex-1 flex-col gap-3 overflow-y-auto p-v-200"
    >
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          onRegenerate={
            message.role === 'assistant'
              ? () => onRegenerate(message.id)
              : undefined
          }
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
