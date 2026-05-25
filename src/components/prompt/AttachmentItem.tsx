import { Badge, IconButton, Spinner, Text, Tooltip } from '@vapor-ui/core';
import { CloseOutlineIcon } from '@vapor-ui/icons';
import { formatBytes } from '../../lib/file';
import type { AttachmentStatus, PromptAttachment } from './types';

type StatusMeta = {
  label: string;
  colorPalette: 'hint' | 'primary' | 'success' | 'danger';
};

const STATUS_META: Record<AttachmentStatus, StatusMeta> = {
  idle: { label: '대기', colorPalette: 'hint' },
  uploading: { label: '업로드 중', colorPalette: 'primary' },
  done: { label: '완료', colorPalette: 'success' },
  error: { label: '실패', colorPalette: 'danger' },
};

export type AttachmentItemProps = {
  attachment: PromptAttachment;
  onRemove: (id: string) => void;
};

/**
 * 개별 첨부 파일의 상태(uploading / done / error)와 메타데이터를 표시한다.
 *
 * 긴 파일명은 말줄임 처리하고 Tooltip 으로 전체 이름을 노출한다.
 */
export function AttachmentItem({ attachment, onRemove }: AttachmentItemProps) {
  const { id, fileName, size, status, truncated, errorMessage } = attachment;
  const meta = STATUS_META[status];
  const isUploading = status === 'uploading';

  return (
    <li
      aria-busy={isUploading}
      className="flex flex-wrap items-center gap-v-100 rounded-v-200 border border-v-normal p-v-200"
    >
      {isUploading && <Spinner size="md" />}
      <Badge colorPalette={meta.colorPalette} size="sm">
        {meta.label}
      </Badge>

      <Tooltip.Root>
        <Tooltip.Trigger
          render={<span className="min-w-0 flex-1 truncate text-left" />}
        >
          {fileName}
        </Tooltip.Trigger>
        <Tooltip.Popup>{fileName}</Tooltip.Popup>
      </Tooltip.Root>

      <Text typography="body3" foreground="hint-200" className="shrink-0">
        {formatBytes(size)}
      </Text>

      {truncated && (
        <Badge colorPalette="warning" size="sm">
          일부 포함
        </Badge>
      )}

      <IconButton
        size="sm"
        variant="ghost"
        aria-label={`${fileName} 첨부 제거`}
        onClick={() => onRemove(id)}
      >
        <CloseOutlineIcon size={16} />
      </IconButton>

      {status === 'error' && errorMessage && (
        <Text
          typography="body3"
          foreground="danger-200"
          role="alert"
          className="basis-full"
        >
          {errorMessage}
        </Text>
      )}
    </li>
  );
}
