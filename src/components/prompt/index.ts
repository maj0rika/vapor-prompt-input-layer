/**
 * Prompt Input Component Layer 의 공개 진입점.
 *
 * 앱 레이어는 이 배럴에서 export 되는 제품 컴포넌트만 사용하고,
 * Vapor primitive 는 직접 import 하지 않는다.
 */
export { PromptBar } from './PromptBar';
export { PromptBox } from './PromptBox';
export { Dropzone } from './Dropzone';
export { PromptModeSelector } from './PromptModeSelector';
export { AttachmentList } from './AttachmentList';
export { AttachmentItem } from './AttachmentItem';
export { DataSourceSelector } from './DataSourceSelector';

export type { PromptBarProps, PromptSubmitPayload } from './PromptBar';
export type {
  PromptBoxProps,
  DropzoneProps,
  PromptModeSelectorProps,
  DataSourceSelectorProps,
  DataSourceOption,
  PromptModeOption,
  AgentMode,
  PromptAttachment,
  AttachmentStatus,
  FileRejectReason,
  FileRejection,
} from './types';
