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
  /** status 가 'error' 일 때의 사유. */
  errorMessage?: string;
  /** 재생성 시 같은 mode/첨부 맥락을 유지하기 위한 원본 요청. */
  request?: AgentRequest;
};

/** 에이전트에 전달하는 요청. PromptBar 의 제출 payload 와 정렬된다. */
export type AgentRequest = {
  text: string;
  mode?: AgentMode;
  dataSources?: string[];
  attachments?: MessageAttachment[];
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
  | { type: 'draft'; value: string; replace?: boolean }
  | { type: 'done' }
  | { type: 'error'; message: string };
