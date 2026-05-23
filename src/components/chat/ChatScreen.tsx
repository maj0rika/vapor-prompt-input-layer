import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Button, Text } from '@vapor-ui/core';
import {
  DeepSeekAgentClient,
  MockAgentClient,
  type AgentClient,
} from '../../agent';
import { PromptBar, type PromptModeOption } from '../prompt';
import { ConversationView } from './ConversationView';
import { EmptyState } from './EmptyState';
import { PreviewPanel, type ValidationPipelineState } from './PreviewPanel';
import {
  deriveRunPipelineSteps,
  type PipelineStepStatus,
} from './runPipeline';
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
  const [previewWidth, setPreviewWidth] = useState(44);
  const [isResizing, setIsResizing] = useState(false);
  const [validationPipeline, setValidationPipeline] = useState<{
    draftId?: string;
    state: ValidationPipelineState;
  }>({ state: 'idle' });
  const splitRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = splitRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const nextWidth = ((bounds.right - event.clientX) / bounds.width) * 100;
      setPreviewWidth(Math.min(62, Math.max(34, nextWidth)));
    };
    const handlePointerUp = () => setIsResizing(false);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizing]);

  // 생성 artifact 를 가진 가장 최근 어시스턴트 메시지.
  const draftMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant' && m.draft),
    [messages],
  );
  const latestDraft = draftMessage?.draft ?? '';
  const latestArtifactSource = draftMessage?.artifactSource;
  const draftId = draftMessage?.id;

  const isEmpty = messages.length === 0;
  const showPreview = draftId ? draftId !== closedDraftId : true;
  const currentValidationPipeline =
    validationPipeline.draftId === draftId ? validationPipeline.state : 'idle';
  const pipelineSteps = deriveRunPipelineSteps({
    hasPrompt: messages.length > 0,
    hasDraft: Boolean(latestDraft),
    hasArtifactSource: Boolean(latestArtifactSource),
    validationState: currentValidationPipeline,
  });

  const handlePickSuggestion = (suggestion: string) => {
    setSeedText(suggestion);
    setSeed((value) => value + 1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-v-400 border border-v-normal bg-v-canvas-100 shadow-sm">
      {/* 헤더 바 */}
      <div className="flex items-center justify-between border-b border-v-normal px-v-300 py-v-150">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Text typography="subtitle2">Run pipeline</Text>
          <Text typography="body4" foreground="hint-200">
            Generate → Canvas → Validate → Repair → Approve
          </Text>
        </div>
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

      <RunPipelineBar steps={pipelineSteps} />

      {/* 본문: 대화 thread | artifact workspace */}
      <div ref={splitRef} className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {isEmpty ? (
            <EmptyState onPick={handlePickSuggestion} />
          ) : (
            <ConversationView messages={messages} onRegenerate={regenerate} />
          )}
        </div>

        {showPreview && (
          <>
            <button
              type="button"
              aria-label={`Artifact workspace width ${Math.round(previewWidth)} percent`}
              className="hidden w-2 cursor-col-resize appearance-none items-stretch justify-center border-0 bg-v-canvas-100 p-0 hover:bg-v-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-v-primary md:flex"
              onPointerDown={(event) => {
                event.preventDefault();
                setIsResizing(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  setPreviewWidth((value) => Math.min(62, value + 4));
                }
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  setPreviewWidth((value) => Math.max(34, value - 4));
                }
              }}
            >
              <span className="h-full w-px bg-v-normal" />
            </button>
            <div
              className="artifact-workspace-pane flex min-h-0 min-w-0 flex-col md:flex-none"
              style={{ '--artifact-workspace-width': `${previewWidth}%` } as CSSProperties}
            >
              <PreviewPanel
                key={draftId}
                draft={latestDraft}
                artifactSource={latestArtifactSource}
                onValidationStateChange={(state) =>
                  setValidationPipeline({ draftId, state })
                }
                onRepair={(payload) =>
                  send({
                    text:
                      '실패한 validation 결과를 바탕으로 수정해줘. 실패한 게이트만 고치고 전체 artifact를 다시 반환해.',
                    mode: 'component',
                    previousArtifactSource: payload.artifactSource,
                    validationResult: payload.validationResult,
                    repairIntent: {
                      failedGates: payload.failedGates,
                      maxAttempts: 1,
                    },
                  })
                }
                canClose={Boolean(draftId)}
                onClose={() => setClosedDraftId(draftId)}
              />
            </div>
          </>
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

function RunPipelineBar({
  steps,
}: {
  steps: ReadonlyArray<{
    label: string;
    status: PipelineStepStatus;
  }>;
}) {
  return (
    <div
      aria-label="Prompt to Artifact to Canvas to Validation to Repair to Approve"
      className="flex flex-wrap items-center gap-1 border-b border-v-normal px-v-200 py-v-150"
    >
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center gap-1">
          <span
            aria-label={`${step.label}: ${step.status}`}
            className={[
              'rounded-v-200 border px-v-150 py-v-075 text-xs font-medium',
              step.status === 'pass'
                ? 'border-v-success bg-v-success-100 text-v-success'
                : step.status === 'fail'
                  ? 'border-v-danger bg-v-danger-100 text-v-danger'
                : step.status === 'active'
                  ? 'border-v-primary bg-v-primary-100 text-v-primary'
                  : 'border-v-normal bg-v-canvas-200 text-v-hint',
            ].join(' ')}
          >
            {step.label}
          </span>
          {index < steps.length - 1 && (
            <span aria-hidden="true" className="text-v-hint">
              →
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function createDefaultAgentClient(): AgentClient {
  if (import.meta.env.VITE_AGENT_CLIENT === 'mock') {
    return new MockAgentClient();
  }
  return new DeepSeekAgentClient();
}
