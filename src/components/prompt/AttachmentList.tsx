import { Text } from '@vapor-ui/core';
import { AttachmentItem } from './AttachmentItem';
import type { PromptAttachment } from './types';

export type AttachmentListProps = {
  attachments: PromptAttachment[];
  onRemove: (id: string) => void;
};

/**
 * 첨부 파일 목록을 표시한다. 첨부가 없으면 아무것도 렌더링하지 않는다.
 */
export function AttachmentList({ attachments, onRemove }: AttachmentListProps) {
  if (attachments.length === 0) return null;

  return (
    <section aria-label="첨부 파일 목록" className="flex flex-col gap-v-50">
      <Text typography="body3" foreground="hint-200">
        첨부 파일 {attachments.length}개
      </Text>
      <ul className="flex list-none flex-col gap-v-50 p-v-0 m-v-0">
        {attachments.map((attachment) => (
          <AttachmentItem
            key={attachment.id}
            attachment={attachment}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </section>
  );
}
