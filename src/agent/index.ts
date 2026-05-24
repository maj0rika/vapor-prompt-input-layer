/**
 * Agent 엔진 레이어의 공개 진입점(배럴).
 *
 * 이 배럴은 `src/agent/**` 외부(앱 레이어 · chat 컴포넌트 레이어)가
 * agent 엔진을 사용할 수 있는 유일한 경로다. 내부 모듈
 * (MockAgentClient, messageMachine 등)의 직접 deep import 는
 * ESLint `no-restricted-imports` 규칙으로 차단된다.
 */
export type { AgentClient } from './AgentClient';
export { DeepSeekAgentClient, parseDeepSeekSseFrame } from './DeepSeekAgentClient';
export { MockAgentClient } from './MockAgentClient';
export { createVerifiedSampleRun } from './verifiedSample';
export { parseGeneratedArtifact } from './responseParser';
export { messageReducer, isTerminal } from './messageMachine';
export type {
  ArtifactMetadata,
  ArtifactVariantMetadata,
  GeneratedArtifact,
} from './responseParser';
export type {
  MetadataValidationResult,
  MetadataValidationStatus,
} from './artifactMetadata';
export type { MachineEvent } from './messageMachine';
export type {
  AgentEvent,
  AgentRequest,
  ArtifactProvenance,
  ChatMessage,
  MessageAttachment,
  MessageStatus,
  Role,
} from './types';
export type { VerifiedSampleRun } from './verifiedSample';
