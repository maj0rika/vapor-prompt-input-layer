/**
 * Prompt Input Component Layer 의 공개 타입.
 *
 * 모든 props 는 Vapor primitive 가 아니라 제품 요구사항을 기준으로 정의한다.
 */

/* ------------------------------------------------------------------ */
/* PromptBox                                                          */
/* ------------------------------------------------------------------ */

export type PromptBoxProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  maxLength?: number;
  disabled?: boolean;
  placeholder?: string;
  submitLabel?: string;
};

/* ------------------------------------------------------------------ */
/* Dropzone                                                           */
/* ------------------------------------------------------------------ */

/** 파일이 거부된 사유. */
export type FileRejectReason =
  | 'unaccepted-type'
  | 'exceeds-max-size'
  | 'too-many-files';

export type FileRejection = {
  fileName: string;
  reason: FileRejectReason;
};

export type DropzoneProps = {
  accept?: string[];
  maxSize?: number;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  onReject?: (rejection: FileRejection) => void;
};

/* ------------------------------------------------------------------ */
/* Attachment                                                         */
/* ------------------------------------------------------------------ */

export type AttachmentStatus = 'idle' | 'uploading' | 'done' | 'error';

export type PromptAttachment = {
  id: string;
  fileName: string;
  size: number;
  status: AttachmentStatus;
  errorMessage?: string;
};

/* ------------------------------------------------------------------ */
/* DataSourceSelector                                                 */
/* ------------------------------------------------------------------ */

export type DataSourceOption = {
  id: string;
  label: string;
  description?: string;
};

export type DataSourceSelectorProps = {
  options: DataSourceOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
};
