/**
 * Agent 엔진 레이어의 공개 진입점(배럴).
 *
 * 이 배럴은 `src/agent/**` 외부(앱 레이어 · chat 컴포넌트 레이어)가
 * agent 엔진을 사용할 수 있는 유일한 경로다. 내부 모듈
 * (MockAgentClient, messageMachine 등)의 직접 deep import 는
 * ESLint `no-restricted-imports` 규칙으로 차단된다.
 */
export type { AgentClient } from './AgentClient';
export { MockAgentClient } from './MockAgentClient';
export { messageReducer, isTerminal } from './messageMachine';
export type { MachineEvent } from './messageMachine';
export type {
  AgentEvent,
  AgentRequest,
  ChatMessage,
  MessageStatus,
  Role,
} from './types';
