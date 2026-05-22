import { useEffect, useMemo, useState } from 'react';
import { Button, Text } from '@vapor-ui/core';
import {
  DeepSeekAgentClient,
  MockAgentClient,
  type AgentClient,
} from '../../agent';
import { PromptBar, type PromptModeOption } from '../prompt';
import { ConversationView } from './ConversationView';
import { EmptyState } from './EmptyState';
import { PreviewPanel } from './PreviewPanel';
import { ThemeToggle } from './ThemeToggle';
import { useAgentStream } from './useAgentStream';

export type ChatScreenProps = {
  /** 자동화 mode 선택 옵션 (도메인 데이터 — 앱 레이어가 주입). */
  modeOptions: PromptModeOption[];
  /** 첨부 허용 파일 형식 (확장자/MIME). 미지정 시 모든 형식 허용. */
  acceptedFileTypes?: string[];
  /** 첨부 파일당 최대 크기. 기본값은 PromptBar 정책을 따른다. */
  maxFileSize?: number;
  /** 한 요청에 포함할 수 있는 최대 첨부 수. */
  maxFiles?: number;
  /** 에이전트 클라이언트. 미지정 시 DeepSeekAgentClient 를 사용한다. */
  client?: AgentClient;
};

/**
 * AI 에이전트 채팅 화면의 최상위 합성 컴포넌트.
 *
 * 헤더 · 본문(대화 thread | artifact workspace) · 입력 영역을 하나의 통합
 * surface 로 조립한다. 좁은 뷰포트에서는 본문 패널이 세로로 스택된다.
 * 스트리밍 중 ESC 로 취소.
 */
export function ChatScreen({
  modeOptions,
  acceptedFileTypes,
  maxFileSize,
  maxFiles,
  client,
}: ChatScreenProps) {
  const agent = useMemo(() => client ?? createDefaultAgentClient(), [client]);
  const { messages, isStreaming, send, regenerate, cancel } =
    useAgentStream(agent);

  // 사용자가 명시적으로 닫은 artifact 의 id. 워크스페이스는 기본 열림이며,
  // 닫은 artifact 와 id 가 다른 새 생성물이 오면 다시 열린다 (effect 불필요).
  const [closedDraftId, setClosedDraftId] = useState<string | undefined>(
    undefined,
  );

  // 작업 템플릿으로 입력창을 채우기 위한 seed. key 와 함께 PromptBar 를 remount 한다.
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

  // 생성 artifact 를 가진 가장 최근 어시스턴트 메시지.
  const draftMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant' && m.draft),
    [messages],
  );
  const latestDraft = draftMessage?.draft ?? '';
  const draftId = draftMessage?.id;

  const isEmpty = messages.length === 0;
  const showPreview = draftId ? draftId !== closedDraftId : true;

  const handlePickSuggestion = (suggestion: string) => {
    setSeedText(suggestion);
    setSeed((value) => value + 1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-v-400 border border-v-normal bg-v-canvas-100 shadow-sm">
      {/* 헤더 바 */}
      <div className="flex items-center justify-between border-b border-v-normal px-v-300 py-v-150">
        <Text typography="subtitle2">Agent run</Text>
        <div className="flex items-center gap-1">
          {Boolean(draftId) && !showPreview && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setClosedDraftId(undefined)}
            >
              Artifact 보기
            </Button>
          )}
          <ThemeToggle />
        </div>
      </div>

      {/* 본문: 대화 thread | artifact workspace */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 flex-1 flex-col">
          {isEmpty ? (
            <EmptyState onPick={handlePickSuggestion} />
          ) : (
            <ConversationView messages={messages} onRegenerate={regenerate} />
          )}
        </div>

        {showPreview && (
          <div className="flex min-h-0 flex-1 flex-col md:max-w-[44%]">
            <PreviewPanel
              draft={latestDraft}
              canClose={Boolean(draftId)}
              onClose={() => setClosedDraftId(draftId)}
            />
          </div>
        )}
      </div>

      {/* 입력 영역 */}
      <div className="border-t border-v-normal p-v-300">
        <PromptBar
          key={seed}
          bare
          defaultText={seedText}
          modeOptions={modeOptions}
          accept={acceptedFileTypes}
          maxFileSize={maxFileSize}
          maxFiles={maxFiles}
          disabled={isStreaming}
          placeholder="예: primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수"
          onSubmit={(payload) =>
            send({
              text: payload.text,
              mode: payload.mode,
              dataSources: payload.dataSources,
              attachments: payload.attachments.map((attachment) => ({
                fileName: attachment.fileName,
                size: attachment.size,
                kind: attachment.kind,
                contentText: attachment.contentText,
                truncated: attachment.truncated,
              })),
            })
          }
        />
      </div>
    </div>
  );
}

function createDefaultAgentClient(): AgentClient {
  if (import.meta.env.VITE_AGENT_CLIENT === 'mock') {
    return new MockAgentClient();
  }
  return new DeepSeekAgentClient();
}
