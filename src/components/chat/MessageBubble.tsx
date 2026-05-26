import { Text } from '@vapor-ui/core';
import { isTerminal, type ChatMessage } from '../../agent';
import { AttachmentChip } from './AttachmentChip';
import { Markdown } from './Markdown';
import { MessageActions } from './MessageActions';
import { MessageAvatar } from './MessageAvatar';
import { StreamingIndicator } from './StreamingIndicator';
import { summarizeLineDiff } from './repairSummary';

export type MessageBubbleProps = {
  message: ChatMessage;
  /**
   * 같은 thread 에서 이 assistant 메시지보다 시간상 앞에 있는 가장 가까운
   * assistant artifact 의 원본. 보수 응답 line-diff 요약에 사용.
   */
  prevAssistantArtifactSource?: string;
  /** 어시스턴트 메시지 재생성. 미지정 시 재생성 버튼을 숨긴다. */
  onRegenerate?: () => void;
};

const SENDER_NAME: Record<ChatMessage['role'], string> = {
  user: '나',
  assistant: 'Vapor DS Agent',
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * user / assistant 메시지 — 아바타, 발신자·시각 메타, 본문 버블, 액션.
 *
 * 스트리밍 중인 어시스턴트 메시지는 본문이 비어 있으면 타이핑 인디케이터를,
 * 텍스트가 들어오면 `aria-live="polite"` 영역으로 점진 렌더한다.
 */
export function MessageBubble({
  message,
  prevAssistantArtifactSource,
  onRegenerate,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const showIndicator = isStreaming && message.text.length === 0;
  const showActions = !isUser && isTerminal(message.status);
  const hasAttachments =
    message.attachments != null && message.attachments.length > 0;
  const repairIntent = !isUser ? message.request?.repairIntent : undefined;
  const repairDiff =
    repairIntent && message.artifactSource && prevAssistantArtifactSource
      ? summarizeLineDiff(prevAssistantArtifactSource, message.artifactSource)
      : undefined;

  const handleCopy = () => {
    void navigator.clipboard?.writeText(message.text);
  };

  return (
    <div
      className={[
        'flex gap-v-100',
        isUser ? 'flex-row-reverse' : 'flex-row',
      ].join(' ')}
    >
      <MessageAvatar role={message.role} />

      <div
        className={[
          'flex min-w-0 max-w-[min(82%,100%)] flex-col gap-v-50',
          isUser ? 'items-end' : 'items-start',
        ].join(' ')}
      >
        <div className="flex items-baseline gap-v-75 px-v-50">
          <Text typography="body4" foreground="normal-200">
            {SENDER_NAME[message.role]}
          </Text>
          <Text typography="body4" foreground="hint-200">
            {formatTime(message.createdAt)}
          </Text>
        </div>

        {repairIntent && (
          <div
            role="note"
            aria-label="보수 응답"
            className="inline-flex flex-wrap items-center gap-v-75 rounded-v-200 border border-v-warning bg-v-warning-100 px-v-150 py-v-50"
          >
            <Text typography="body4" foreground="warning-200">
              [보수 시도]
            </Text>
            <Text typography="body4">
              실패 게이트: {repairIntent.failedGates.join(', ') || '미상'}
            </Text>
            {repairDiff && (repairDiff.added > 0 || repairDiff.removed > 0) && (
              <Text typography="body4" foreground="hint-200">
                변경 +{repairDiff.added} / −{repairDiff.removed} 줄 · 검증 재실행
                필요
              </Text>
            )}
            {!repairDiff && (
              <Text typography="body4" foreground="hint-200">
                새 artifact 적용됨 · 검증 재실행 필요
              </Text>
            )}
          </div>
        )}

        <div
          data-role={message.role}
          data-status={message.status}
          className={[
            'max-w-full overflow-hidden rounded-v-300 px-v-200 py-v-150',
            isUser
              ? 'rounded-tr-v-0 bg-v-primary-100'
              : 'rounded-tl-v-0 bg-v-canvas-200',
          ].join(' ')}
        >
          {hasAttachments && (
            <div className="mb-v-75 flex flex-wrap gap-v-75">
              {message.attachments!.map((attachment, index) => (
                <AttachmentChip key={index} attachment={attachment} />
              ))}
            </div>
          )}

          {showIndicator ? (
            <StreamingIndicator
              startedAt={message.createdAt}
              phase="thinking"
            />
          ) : (
            message.text.length > 0 &&
            (isUser ? (
              <Text
                typography="body2"
                className="block whitespace-pre-wrap break-words"
              >
                {message.text}
              </Text>
            ) : (
              <div aria-live={isStreaming ? 'polite' : undefined}>
                <Markdown>{message.text}</Markdown>
                {isStreaming && (
                  <div className="mt-v-100">
                    <StreamingIndicator
                      startedAt={message.createdAt}
                      phase="streaming"
                    />
                  </div>
                )}
              </div>
            ))
          )}

          {message.status === 'error' && message.errorMessage && (
            <Text
              typography="body3"
              foreground="danger-200"
              role="alert"
              className="mt-v-50 block"
            >
              {message.errorMessage}
            </Text>
          )}

          {message.status === 'cancelled' && (
            <Text typography="body3" foreground="hint-200" className="mt-v-50 block">
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
