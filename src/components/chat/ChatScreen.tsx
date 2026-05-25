import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Button, Text } from '@vapor-ui/core';
import {
  DeepSeekAgentClient,
  MockAgentClient,
  assertRepairIntentHasParentRunId,
  createArtifactRunFromMessage,
  createVerifiedSampleRun,
  createTemplateSampleRun,
  type AgentClient,
  type ArtifactRunSource,
  type TemplateKey,
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

/**
 * 한 repair chain 안에서 허용되는 최대 "Fix with Agent" / gate 수정 클릭 수.
 *
 * 도달 시 PreviewPanel 의 repair 버튼이 disabled 되어 (1) 무한 retry 로 인한
 * API 비용 및 자원 leak 을 차단하고, (2) 사용자에게 새 prompt 또는 새
 * sample 로 chain 을 reset 하도록 유도한다.
 */
export const MAX_REPAIR_ATTEMPTS_PER_CHAIN = 3;

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
  const { messages, isStreaming, send, loadSampleRun, regenerate, cancel } =
    useAgentStream(agent);

  // 사용자가 명시적으로 닫은 artifact 의 id. 워크스페이스는 기본 열림이며,
  // 닫은 artifact 와 id 가 다른 새 생성물이 오면 다시 열린다 (effect 불필요).
  const [closedDraftId, setClosedDraftId] = useState<string | undefined>(
    undefined,
  );
  const [previewWidth, setPreviewWidth] = useState(44);
  const [isResizing, setIsResizing] = useState(false);
  const [validationPipeline, setValidationPipeline] = useState<{
    artifactRunId?: string;
    state: ValidationPipelineState;
  }>({ state: 'idle' });
  /**
   * 한 repair chain 안에서 user 가 "실패 수정 (Fix with Agent)" 또는 gate
   * 단위 수정 버튼을 누른 횟수. 한도(MAX_REPAIR_ATTEMPTS_PER_CHAIN)에 도달
   * 하면 PreviewPanel 에서 repair 버튼이 disabled 된다.
   *
   * 카운터는 다음 시점에 reset 된다:
   *   - 사용자가 PromptBar 로 새 prompt 를 보낼 때
   *   - sample / template / regenerate 로 새 ArtifactRun 이 시작될 때
   *   - 새 validation 결과가 pass 인 경우 (한도 회복; 다음 fail 까지)
   *
   * 1회 send 자체는 advisory `maxAttempts: 1` 을 LLM 에 알려주지만, client
   * 측에서 hard cap 으로 강제하지 않으면 user 가 무한 retry 할 수 있어
   * API 비용 + 자원이 leak 된다.
   */
  const [repairChainAttempts, setRepairChainAttempts] = useState(0);
  const splitRef = useRef<HTMLDivElement>(null);


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
  // G011: ChatMessage → ArtifactRun adapter. PreviewPanel/validation/approval
  // 은 message 가 아니라 ArtifactRun lifecycle 에 묶인다 (도메인 모델 1차 분리).
  // G011.1: source 를 active client 종류에 따라 명시적으로 전달해 mock/deepseek
  // 가 런타임에서 혼동되지 않게 한다. deterministic-sample provenance 는 adapter
  // 내부에서 sample 로 자동 매핑된다.
  const liveSource: ArtifactRunSource =
    agent instanceof MockAgentClient ? 'mock' : 'deepseek';
  const currentArtifactRun = useMemo(
    () =>
      draftMessage
        ? createArtifactRunFromMessage(draftMessage, { source: liveSource })
        : undefined,
    [draftMessage, liveSource],
  );
  const latestDraft = draftMessage?.draft ?? '';
  const latestArtifactSource = draftMessage?.artifactSource;
  const latestArtifactProvenance = draftMessage?.artifactProvenance;
  const latestArtifactMode = currentArtifactRun?.mode ?? draftMessage?.request?.mode;
  const draftId = draftMessage?.id;
  const artifactRunId = currentArtifactRun?.id;

  const isEmpty = messages.length === 0;
  const showPreview = draftId ? draftId !== closedDraftId : true;
  const currentValidationPipeline =
    validationPipeline.artifactRunId === artifactRunId
      ? validationPipeline.state
      : 'idle';
  const pipelineSteps = deriveRunPipelineSteps({
    hasPrompt: messages.length > 0,
    hasDraft: Boolean(latestDraft),
    hasArtifactSource: Boolean(latestArtifactSource),
    validationState: currentValidationPipeline,
  });

  const handlePickSuggestion = (templateKey: TemplateKey) => {
    setClosedDraftId(undefined);
    setValidationPipeline({ state: 'idle' });
    setRepairChainAttempts(0);
    loadSampleRun(createTemplateSampleRun(templateKey));
  };

  const handleRunVerifiedSample = () => {
    setClosedDraftId(undefined);
    setValidationPipeline({ state: 'idle' });
    setRepairChainAttempts(0);
    loadSampleRun(createVerifiedSampleRun());
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
            <EmptyState
              onPick={handlePickSuggestion}
              onRunVerifiedSample={handleRunVerifiedSample}
            />
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
                key={artifactRunId}
                draft={latestDraft}
                artifactSource={latestArtifactSource}
                artifactProvenance={latestArtifactProvenance}
                artifactMode={latestArtifactMode}
                onValidationStateChange={(state) => {
                  setValidationPipeline({ artifactRunId, state });
                  // pass 면 repair chain 종료 — 카운터 reset 후 새 chain 재개
                  // 가능. fail 은 사용자가 수정 버튼을 누를 수 있게 유지.
                  if (state === 'pass') setRepairChainAttempts(0);
                }}
                repairChainAttempts={repairChainAttempts}
                maxRepairAttemptsPerChain={MAX_REPAIR_ATTEMPTS_PER_CHAIN}
                onRepair={(payload) => {
                  if (repairChainAttempts >= MAX_REPAIR_ATTEMPTS_PER_CHAIN) return;
                  const repairRequest = {
                    text:
                      '실패한 validation 결과를 바탕으로 수정해줘. 실패한 게이트만 고치고 전체 artifact를 다시 반환해.',
                    mode: latestArtifactMode ?? 'component',
                    previousArtifactSource: payload.artifactSource,
                    validationResult: payload.validationResult,
                    repairIntent: {
                      failedGates: payload.failedGates,
                      maxAttempts: 1,
                      // G011: 실패한 ArtifactRun 의 id 를 보존해 repair lineage 추적.
                      parentRunId: currentArtifactRun?.id,
                    },
                  };
                  // G011.1: parentRunId 누락 시 즉시 throw — repair lineage 회귀 차단.
                  assertRepairIntentHasParentRunId(repairRequest);
                  setRepairChainAttempts((value) => value + 1);
                  send(repairRequest);
                }}
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
          bare
          modeOptions={modeOptions}
          accept={acceptedFileTypes}
          maxFileSize={maxFileSize}
          maxFiles={maxFiles}
          disabled={isStreaming}
          placeholder="예: primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수"
          onSubmit={(payload) => {
            // 새 prompt 는 새 repair chain 의 시작이므로 counter reset. 직전
            // chain 이 max 에 도달했어도 다음 chain 에서 다시 3번 시도 가능.
            setRepairChainAttempts(0);
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
            });
          }}
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
