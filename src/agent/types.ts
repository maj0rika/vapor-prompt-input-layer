/**
 * Agent 엔진의 공개 타입.
 *
 * 이 레이어는 React·DOM 에 의존하지 않는 순수 로직이다.
 */

export type Role = 'user' | 'assistant';

export type AgentMode = 'component' | 'token-sync' | 'a11y-audit' | 'story-test';

/** 메시지 단위 상태. 상태머신(messageMachine)이 관리한다. */
export type MessageStatus =
  | 'idle'
  | 'streaming'
  | 'done'
  | 'error'
  | 'cancelled';

export type ArtifactProvenance = 'generated' | 'deterministic-sample';

/** 메시지에 함께 표시되는 첨부 파일 메타데이터. */
export type MessageAttachment = {
  fileName: string;
  size: number;
  kind?: 'tokens' | 'component' | 'spec' | 'text';
  contentText?: string;
  truncated?: boolean;
};

export type ChatMessage = {
  id: string;
  role: Role;
  /** 현재까지 누적된 본문 텍스트. */
  text: string;
  status: MessageStatus;
  /** 메시지 생성 시각 (epoch ms). */
  createdAt: number;
  /** 함께 전송된 첨부 파일. */
  attachments?: MessageAttachment[];
  /** 어시스턴트가 작성한 생성 artifact (PreviewPanel 에 렌더링). */
  draft?: string;
  /** 실제 validation runner 에 다시 보낼 delimiter 기반 원본 artifact. */
  artifactSource?: string;
  /** 생성물 출처. deterministic sample 은 모델 호출이 아님을 UI 에 표시한다. */
  artifactProvenance?: ArtifactProvenance;
  /** status 가 'error' 일 때의 사유. */
  errorMessage?: string;
  /** 재생성 시 같은 mode/첨부 맥락을 유지하기 위한 원본 요청. */
  request?: AgentRequest;
};

/** 멀티턴 컨텍스트로 모델에 함께 전달되는 직전 대화 turn. */
export type PriorTurn = {
  role: 'user' | 'assistant';
  content: string;
};

/** 에이전트에 전달하는 요청. PromptBar 의 제출 payload 와 정렬된다. */
export type AgentRequest = {
  text: string;
  mode?: AgentMode;
  dataSources?: string[];
  attachments?: MessageAttachment[];
  previousArtifactSource?: string;
  validationResult?: unknown;
  repairIntent?: {
    failedGates: Array<'typecheck' | 'unit' | 'runtime' | 'axe' | 'token' | 'cleanup'>;
    maxAttempts: number;
    /** G011: 어느 ArtifactRun 의 실패를 수정하는 요청인지 lineage 추적용. */
    parentRunId?: string;
  };
  /**
   * 멀티턴 대화 컨텍스트. 현재 요청 직전까지의 user/assistant 메시지를
   * 시간순으로 담는다. 비어 있으면 첫 turn 처럼 동작한다.
   */
  priorTurns?: PriorTurn[];
};

/**
 * 스트리밍 중 방출되는 이벤트.
 * - token: 응답 본문 토큰
 * - draft: PreviewPanel 에 렌더링할 생성 artifact 토큰
 * - done : 정상 종료
 * - error: 오류 종료
 */
export type AgentEvent =
  | { type: 'token'; value: string }
  | { type: 'draft'; value: string; replace?: boolean; source?: string }
  | { type: 'done' }
  | { type: 'error'; message: string };
