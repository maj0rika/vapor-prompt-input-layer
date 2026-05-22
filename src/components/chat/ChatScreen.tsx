import { useEffect, useMemo, useState } from 'react';
import { Button } from '@vapor-ui/core';
import { MockAgentClient, type AgentClient } from '../../agent';
import { PromptBar, type DataSourceOption } from '../prompt';
import { ConversationView } from './ConversationView';
import { EmptyState } from './EmptyState';
import { PreviewPanel } from './PreviewPanel';
import { useAgentStream } from './useAgentStream';

export type ChatScreenProps = {
  /** 입력창 데이터소스 선택 옵션 (도메인 데이터 — 앱 레이어가 주입). */
  dataSourceOptions: DataSourceOption[];
  /** 에이전트 클라이언트. 미지정 시 MockAgentClient 를 사용한다. */
  client?: AgentClient;
};

/**
 * AI 에이전트 채팅 화면의 최상위 합성 컴포넌트.
 *
 * 좌측 대화 thread(ConversationView) + 우측 초안 미리보기(PreviewPanel)의
 * split-panel 셸이며, 하단에 입력 영역(PromptBar)을 둔다. 좁은 뷰포트에서는
 * 두 패널이 세로로 스택된다. 스트리밍 중 ESC 로 취소.
 */
export function ChatScreen({ dataSourceOptions, client }: ChatScreenProps) {
  const agent = useMemo(() => client ?? new MockAgentClient(), [client]);
  const { messages, isStreaming, send, regenerate, cancel } =
    useAgentStream(agent);

  // 사용자가 명시적으로 닫은 초안의 id. 미리보기는 기본 열림이며,
  // 닫은 초안과 id 가 다른 새 초안이 오면 다시 열린다 (effect 불필요).
  const [closedDraftId, setClosedDraftId] = useState<string | undefined>(
    undefined,
  );

  // 추천 칩으로 입력창을 채우기 위한 seed. key 와 함께 PromptBar 를 remount 한다.
  const [seed, setSeed] = useState(0);
  const [seedText, setSeedText] = useState('');

  useEffect(() => {
    if (!isStreaming) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, cancel]);

  // 초안을 가진 가장 최근 어시스턴트 메시지.
  const draftMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant' && m.draft),
    [messages],
  );
  const latestDraft = draftMessage?.draft ?? '';
  const draftId = draftMessage?.id;

  const isEmpty = messages.length === 0;
  const showPreview = Boolean(draftId) && draftId !== closedDraftId;

  const handlePickSuggestion = (suggestion: string) => {
    setSeedText(suggestion);
    setSeed((value) => value + 1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
        {/* 좌: 대화 thread */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-v-400 border border-v-normal bg-v-canvas-100">
          {Boolean(draftId) && !showPreview && (
            <div className="flex justify-end border-b border-v-normal px-v-200 py-v-100">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setClosedDraftId(undefined)}
              >
                초안 보기
              </Button>
            </div>
          )}
          {isEmpty ? (
            <EmptyState onPick={handlePickSuggestion} />
          ) : (
            <ConversationView messages={messages} onRegenerate={regenerate} />
          )}
        </div>

        {/* 우: 초안 미리보기 */}
        {showPreview && (
          <div className="flex min-h-0 flex-1 flex-col md:max-w-[45%]">
            <PreviewPanel
              draft={latestDraft}
              onClose={() => setClosedDraftId(draftId)}
            />
          </div>
        )}
      </div>

      <PromptBar
        key={seed}
        defaultText={seedText}
        dataSourceOptions={dataSourceOptions}
        multipleDataSources
        disabled={isStreaming}
        placeholder="글쓰기에 대해 무엇이든 물어보세요."
        onSubmit={(payload) =>
          send({
            text: payload.text,
            dataSources: payload.dataSources,
            attachments: payload.attachments.map((attachment) => ({
              fileName: attachment.fileName,
            })),
          })
        }
      />
    </div>
  );
}
