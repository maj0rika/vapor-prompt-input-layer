import { useEffect, useMemo } from 'react';
import { Text } from '@vapor-ui/core';
import { MockAgentClient, type AgentClient } from '../../agent';
import { PromptBar, type DataSourceOption } from '../prompt';
import { ConversationView } from './ConversationView';
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
 * 대화 thread(ConversationView) + 입력 영역(PromptBar)을 조립하고,
 * useAgentStream 으로 스트리밍 상태를 관리한다. 스트리밍 중 ESC 로 취소.
 */
export function ChatScreen({ dataSourceOptions, client }: ChatScreenProps) {
  const agent = useMemo(() => client ?? new MockAgentClient(), [client]);
  const { messages, isStreaming, send, cancel } = useAgentStream(agent);

  useEffect(() => {
    if (!isStreaming) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, cancel]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-v-400 border border-v-normal bg-v-canvas-100">
        {isEmpty ? (
          <div className="flex flex-1 items-center justify-center p-v-400 text-center">
            <Text typography="body2" foreground="hint-200">
              글쓰기에 대해 무엇이든 물어보세요. 문장 다듬기, 초안 작성, 제목
              추천을 도와드립니다.
            </Text>
          </div>
        ) : (
          <ConversationView messages={messages} />
        )}
      </div>

      <PromptBar
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
