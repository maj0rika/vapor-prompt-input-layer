/**
 * ArtifactRun MVP — conversation message 와 분리된 산출물 lifecycle 도메인 모델.
 *
 * G001~G010 까지는 PreviewPanel/validation/approval 이 ChatMessage 와
 * `${message.id}:${createdAt}` 합성 키에 암묵적으로 묶여 있었다. G011 은 동일
 * lifecycle 을 명시적인 `ArtifactRun` 으로 표현해 (a) 이전 run 의 validation/
 * approval 이 새 run 으로 carry-over 되지 않음을 도메인 레벨에서 증명하고,
 * (b) repair 가 `parentRunId` 를 통해 추적 가능하게 한다.
 *
 * 회귀 보호를 위해 ChatMessage state 는 그대로 두고 `createArtifactRunFromMessage`
 * adapter 를 거쳐 derive 한다. 후속 작업에서 message state 와 분리될 수 있다.
 */
import type { AgentMode, ArtifactProvenance, ChatMessage } from './types';
import { parseGeneratedArtifact, type GeneratedArtifact } from './responseParser';
import type { MetadataValidationResult } from './artifactMetadata';

export type ArtifactRunSource = 'deepseek' | 'sample' | 'mock';

export type ArtifactRunStatus =
  | 'created'      // artifact 도착, preview/validation 미실행
  | 'previewing'   // Canvas iframe mount 대기
  | 'ready'        // Canvas 또는 non-visual workspace 준비됨
  | 'validating'   // validation runner 실행 중
  | 'passed'       // validation 전체 PASS
  | 'failed'       // validation 또는 preview FAIL
  | 'approved'     // 사용자가 로컬 리뷰 승인 (파일/PR 없음)
  | 'superseded';  // 이후 새 run 이 생성되어 active 가 아님

export type CanvasPreviewStatus = 'loading' | 'ready' | 'failed' | 'timeout';

export type PreviewState = {
  status: CanvasPreviewStatus | 'idle';
  error?: string;
};

export type ApprovalState = {
  type: 'local-review';
  approvedAt: number;
};

export type RemoteValidationDetail = {
  label: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  durationMs?: number;
  output?: string;
};

export type RemoteValidationResult = {
  status: 'pass' | 'warn' | 'fail';
  durationMs: number;
  details: RemoteValidationDetail[];
};

export type RepairAttempt = {
  /** 어느 ArtifactRun 의 실패를 수정하려고 했는지 */
  parentRunId: string;
  failedGates: string[];
  startedAt: number;
};

export type ArtifactRun = {
  id: string;
  source: ArtifactRunSource;
  mode: AgentMode;
  status: ArtifactRunStatus;
  artifact: GeneratedArtifact;
  artifactSource: string;
  artifactProvenance?: ArtifactProvenance;
  metadataValidation: MetadataValidationResult;
  preview: PreviewState;
  validation?: RemoteValidationResult;
  approval?: ApprovalState;
  repairHistory: RepairAttempt[];
  createdAt: number;
};

/**
 * ChatMessage → ArtifactRun 어댑터.
 *
 * 인자 message 는 role='assistant' 이며 draft/artifactSource 가 있어야 한다.
 * 그렇지 않으면 `undefined` 를 반환해 caller 가 noop 처리할 수 있게 한다.
 *
 * id 는 `${message.id}:${createdAt}` 합성으로 기존 artifactRunId 표기와 호환된다.
 * 후속 작업에서 도메인 store 가 자체 id 를 발급해도 어댑터 시그니처는 동일.
 */
export function createArtifactRunFromMessage(
  message: ChatMessage,
  options: { source?: ArtifactRunSource } = {},
): ArtifactRun | undefined {
  if (message.role !== 'assistant') return undefined;
  if (!message.artifactSource) return undefined;

  const artifact = parseGeneratedArtifact(message.artifactSource);
  const mode: AgentMode = message.request?.mode ?? 'component';
  const source: ArtifactRunSource =
    options.source ??
    (message.artifactProvenance === 'deterministic-sample' ? 'sample' : 'deepseek');

  return {
    id: `${message.id}:${message.createdAt}`,
    source,
    mode,
    status: 'created',
    artifact,
    artifactSource: message.artifactSource,
    artifactProvenance: message.artifactProvenance,
    metadataValidation:
      artifact.metadataValidation ?? {
        status: 'warn',
        messages: [],
        warnings: [],
        errors: [],
      },
    preview: { status: 'idle' },
    repairHistory: [],
    createdAt: message.createdAt,
  };
}

/** ArtifactRun 의 validation 결과를 갱신하고 status 도 함께 전환. */
export function withValidation(
  run: ArtifactRun,
  validation: RemoteValidationResult,
): ArtifactRun {
  return {
    ...run,
    validation,
    status: validation.status === 'pass' ? 'passed' : 'failed',
  };
}

/** 사용자가 로컬 승인을 누른 시점의 ApprovalState 반영. repo write 없음. */
export function withApproval(run: ArtifactRun, approvedAt: number): ArtifactRun {
  return {
    ...run,
    approval: { type: 'local-review', approvedAt },
    status: 'approved',
  };
}

/** 이 run 을 supersede 처리 (이후 새 run 으로 대체될 때 사용). */
export function markSuperseded(run: ArtifactRun): ArtifactRun {
  return { ...run, status: 'superseded' };
}

/** validation 결과에서 필수 gate 들이 모두 pass 인지 판정 (Approve gate 조건). */
export function isApprovable(run: ArtifactRun): boolean {
  return run.validation?.status === 'pass';
}
