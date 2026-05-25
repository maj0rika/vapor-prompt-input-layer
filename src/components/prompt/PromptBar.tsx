import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { Button, IconButton, Text, Textarea, Tooltip } from '@vapor-ui/core';
import { AttachFileOutlineIcon } from '@vapor-ui/icons';
import { describeRejection, validateFiles } from '../../lib/validation';
import { AttachmentList } from './AttachmentList';
import { PromptModeSelector } from './PromptModeSelector';
import type {
  AgentMode,
  FileRejection,
  PromptAttachment,
  PromptModeOption,
} from './types';

export type PromptSubmitPayload = {
  text: string;
  attachments: PromptAttachment[];
  mode: AgentMode;
  /** 이전 API 호환용. DS 자동화에서는 선택한 mode 하나만 담는다. */
  dataSources: string[];
};

export type PromptBarProps = {
  modeOptions?: PromptModeOption[];
  /** @deprecated use modeOptions */
  dataSourceOptions?: PromptModeOption[];
  defaultMode?: AgentMode;
  multipleDataSources?: boolean;
  maxLength?: number;
  accept?: string[];
  maxFileSize?: number;
  maxFiles?: number;
  multipleFiles?: boolean;
  disabled?: boolean;
  placeholder?: string;
  defaultText?: string;
  compactDropzone?: boolean;
  bare?: boolean;
  onSubmit: (payload: PromptSubmitPayload) => void;
};

const DEFAULT_MODE_OPTIONS: PromptModeOption[] = [
  { id: 'component', label: 'Component', description: 'React 컴포넌트 생성' },
  { id: 'token-sync', label: 'Token Sync', description: 'Figma Variables 매핑' },
  { id: 'a11y-audit', label: 'A11y Audit', description: '접근성 결함 탐지' },
  { id: 'story-test', label: 'Story/Test', description: '스토리와 테스트 작성' },
];

const ATTACHMENT_TEXT_LIMIT = 16_000;
const DEFAULT_MAX_FILE_SIZE = 300 * 1024;
const DEFAULT_MAX_FILES = 5;

export function PromptBar({
  modeOptions,
  dataSourceOptions,
  defaultMode = 'component',
  maxLength = 1600,
  accept,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  maxFiles = DEFAULT_MAX_FILES,
  multipleFiles = true,
  disabled = false,
  placeholder = 'Vapor 컴포넌트 자동화 요청을 입력하세요.',
  defaultText,
  bare = false,
  onSubmit,
}: PromptBarProps) {
  const options = modeOptions ?? dataSourceOptions ?? DEFAULT_MODE_OPTIONS;
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(defaultText ?? '');
  const [mode, setMode] = useState<AgentMode>(defaultMode);
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [lastRejection, setLastRejection] = useState<FileRejection | null>(null);

  const charCount = text.length;
  const overLimit = maxLength != null && charCount > maxLength;
  const isEmpty = text.trim().length === 0;
  const hasUploading = attachments.some((attachment) => attachment.status === 'uploading');
  const canSubmit = !disabled && !isEmpty && !overLimit && !hasUploading;
  const composerClassName = [
    'relative flex flex-col gap-v-100 rounded-v-400 border bg-v-canvas-100 p-v-200 transition-colors',
    isDragOver ? 'border-v-primary bg-v-primary-100' : 'border-v-normal',
    bare ? '' : 'shadow-sm',
  ].join(' ');

  const patchAttachment = (id: string, patch: Partial<PromptAttachment>) => {
    setAttachments((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const handleFiles = (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;
    const remainingFileSlots =
      maxFiles == null ? undefined : Math.max(maxFiles - attachments.length, 0);

    const { accepted, rejections } = validateFiles(Array.from(fileList), {
      accept,
      maxSize: maxFileSize,
      multiple: multipleFiles,
      maxFiles: remainingFileSlots,
    });

    if (rejections.length > 0) {
      setLastRejection(rejections[0]);
    } else {
      setLastRejection(null);
    }

    const incoming: Array<{ file: File; attachment: PromptAttachment }> =
      accepted.map((file) => ({
        file,
        attachment: {
          id: crypto.randomUUID(),
          fileName: file.name,
          size: file.size,
          kind: inferAttachmentKind(file.name),
          status: 'uploading',
        },
      }));

    if (incoming.length === 0) return;
    setAttachments((prev) => [...prev, ...incoming.map(({ attachment }) => attachment)]);

    incoming.forEach(({ file, attachment }) => {
      void file
        .text()
        .then((content) => {
          const text = trimAttachmentText(content);
          patchAttachment(attachment.id, {
            status: 'done',
            contentText: text.value,
            truncated: text.truncated,
          });
        })
        .catch(() => {
          patchAttachment(attachment.id, {
            status: 'error',
            errorMessage: '파일 텍스트를 읽지 못했습니다.',
          });
        });
    });
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ text, attachments, mode, dataSources: [mode] });
    setText('');
    setAttachments([]);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    handleSubmit();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    event.target.value = '';
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    handleFiles(event.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-v-100">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-state={isDragOver ? 'dragover' : 'idle'}
        className={composerClassName}
      >
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-v-400 border border-dashed border-v-primary bg-v-primary-100/80">
            <Text typography="subtitle2" foreground="primary-200">
              Figma variables, token JSON, TSX, MD 파일을 놓으세요.
            </Text>
          </div>
        )}

        <AttachmentList attachments={attachments} onRemove={handleRemoveAttachment} />

        <div className="flex flex-wrap items-center justify-between gap-v-100">
          <div className="flex min-w-0 flex-wrap items-center gap-v-100">
            <PromptModeSelector
              options={options}
              value={mode}
              onChange={setMode}
              disabled={disabled}
            />

            <Tooltip.Root>
              <Tooltip.Trigger
                render={
                  <IconButton
                    type="button"
                    size="md"
                    variant="outline"
                    aria-label="참고 파일 첨부"
                    disabled={disabled}
                    onClick={() => inputRef.current?.click()}
                  />
                }
              >
                <AttachFileOutlineIcon size={18} />
              </Tooltip.Trigger>
              <Tooltip.Popup>Figma 변수, 토큰, 컴포넌트, 스펙 첨부</Tooltip.Popup>
            </Tooltip.Root>

            <input
              ref={inputRef}
              type="file"
              accept={accept?.join(',')}
              multiple={multipleFiles}
              disabled={disabled}
              onChange={handleInputChange}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
        </div>

        <Textarea
          className="min-h-[96px] border-0"
          value={text}
          onValueChange={(next) => setText(next)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          invalid={overLimit}
          aria-label="자동화 프롬프트 입력"
          rows={3}
        />

        <div className="flex flex-wrap items-center justify-between gap-v-100">
          {maxLength != null ? (
            <Text
              typography="body3"
              foreground={overLimit ? 'danger-200' : 'hint-200'}
              aria-live="polite"
            >
              {charCount} / {maxLength}
            </Text>
          ) : (
            <span aria-hidden="true" />
          )}
          <Button
            type="button"
            colorPalette="primary"
            disabled={!canSubmit}
            onClick={handleSubmit}
            aria-label="자동화 실행"
          >
            실행
          </Button>
        </div>
      </div>

      {lastRejection && (
        <Text typography="body3" foreground="danger-200" role="alert">
          {lastRejection.fileName} — {describeRejection(lastRejection.reason)}
        </Text>
      )}
    </div>
  );

  function handleRemoveAttachment(id: string) {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }
}

function inferAttachmentKind(fileName: string): PromptAttachment['kind'] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return 'tokens';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'component';
  if (lower.endsWith('.md')) return 'spec';
  return 'text';
}

function trimAttachmentText(content: string): { value: string; truncated: boolean } {
  if (content.length <= ATTACHMENT_TEXT_LIMIT) {
    return { value: content, truncated: false };
  }
  return {
    value: `${content.slice(0, ATTACHMENT_TEXT_LIMIT)}\n\n[trimmed]`,
    truncated: true,
  };
}
