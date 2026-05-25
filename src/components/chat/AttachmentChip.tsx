import { Text } from '@vapor-ui/core';
import { FileIcon } from '@vapor-ui/icons';
import { formatBytes } from '../../lib/file';
import type { MessageAttachment } from '../../agent';

export type AttachmentChipProps = {
  attachment: MessageAttachment;
};

/** 대화 메시지에 함께 표시되는 첨부 파일 칩. */
export function AttachmentChip({ attachment }: AttachmentChipProps) {
  return (
    <div className="flex items-center gap-v-75 rounded-v-200 border border-v-normal bg-v-canvas-100 px-v-150 py-v-100">
      <FileIcon size={14} aria-hidden="true" />
      <Text typography="body3" className="max-w-[180px] truncate">
        {attachment.fileName}
      </Text>
      <Text typography="body4" foreground="hint-200" className="shrink-0">
        {formatBytes(attachment.size)}
        {attachment.truncated ? ' · 일부 포함' : ''}
      </Text>
    </div>
  );
}
