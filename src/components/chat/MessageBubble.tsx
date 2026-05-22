import { Text } from '@vapor-ui/core';
import { isTerminal, type ChatMessage } from '../../agent';
import { AttachmentChip } from './AttachmentChip';
import { MessageActions } from './MessageActions';
import { StreamingIndicator } from './StreamingIndicator';

export type MessageBubbleProps = {
  message: ChatMessage;
  /** 어시스턴트 메시지 재생성. 미지정 시 재생성 버튼을 숨긴다. */
  onRegenerate?: () => void;
};

/**
 * user / assistant 메시지 버블.
 *
 * 스트리밍 중인 어시스턴트 메시지는 본문이 비어 있으면 타이핑 인디케이터를,
 * 텍스트가 들어오면 `aria-live="polite"` 영역으로 점진 렌더한다. 종료된
 * 어시스턴트 메시지에는 액션(복사·재생성·피드백)을 노출한다.
 */
export function MessageBubble({ message, onRegenerate }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const showIndicator = isStreaming && message.text.length === 0;
  const showActions = !isUser && isTerminal(message.status);

  const handleCopy = () => {
    void navigator.clipboard?.writeText(message.text);
  };

  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div className="flex max-w-[80%] flex-col">
        <div
          data-role={message.role}
          data-status={message.status}
          className={[
            'rounded-v-300 px-v-200 py-v-150',
            isUser ? 'bg-v-primary-100' : 'bg-v-canvas-200',
          ].join(' ')}
        >
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {message.attachments.map((attachment, index) => (
                <AttachmentChip key={index} attachment={attachment} />
              ))}
            </div>
          )}

          {showIndicator ? (
            <StreamingIndicator />
          ) : (
            <Text
              typography="body2"
              className="block whitespace-pre-wrap break-words"
              aria-live={!isUser && isStreaming ? 'polite' : undefined}
            >
              {message.text}
            </Text>
          )}

          {message.status === 'error' && message.errorMessage && (
            <Text
              typography="body3"
              foreground="danger-200"
              role="alert"
              className="mt-1 block"
            >
              {message.errorMessage}
            </Text>
          )}

          {message.status === 'cancelled' && (
            <Text typography="body3" foreground="hint-200" className="mt-1 block">
              응답이 중단되었습니다.
            </Text>
          )}
        </div>

        {showActions && (
          <MessageActions onCopy={handleCopy} onRegenerate={onRegenerate} />
        )}
      </div>
    </div>
  );
}
