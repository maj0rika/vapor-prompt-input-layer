import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Button, Callout, Text } from '@vapor-ui/core';
import { describeRejection, validateFiles } from '../../lib/validation';
import type { DropzoneProps, FileRejection } from './types';

/**
 * 파일 드래그&드롭 / 클릭 업로드를 담당하는 제품 컴포넌트.
 *
 * accept / maxSize / multiple 제약을 검증하고, 거부된 파일은 Callout 으로
 * 피드백하면서 onReject 콜백으로도 알린다. 키보드 사용자는 "파일 선택"
 * 버튼으로 파일 대화상자를 열 수 있다.
 */
export function Dropzone({
  accept,
  maxSize,
  multiple = false,
  disabled = false,
  compact = false,
  onFiles,
  onReject,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [lastRejection, setLastRejection] = useState<FileRejection | null>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const { accepted, rejections } = validateFiles(Array.from(fileList), {
      accept,
      maxSize,
      multiple,
    });

    if (accepted.length > 0) onFiles(accepted);

    if (rejections.length > 0) {
      setLastRejection(rejections[0]);
      rejections.forEach((rejection) => onReject?.(rejection));
    } else {
      setLastRejection(null);
    }
  };

  const openFileDialog = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    // 같은 파일을 다시 선택해도 change 가 발생하도록 값을 비운다.
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
        data-state={disabled ? 'disabled' : isDragOver ? 'dragover' : 'idle'}
        className={[
          'flex items-center gap-v-100 rounded-v-300 border border-dashed transition-colors',
          compact
            ? 'justify-between p-v-150'
            : 'min-h-[96px] flex-col justify-center p-v-300 text-center',
          disabled
            ? 'border-v-hint opacity-60'
            : isDragOver
              ? 'border-v-primary bg-v-primary-100'
              : 'border-v-normal',
        ].join(' ')}
      >
        <Text typography={compact ? 'body3' : 'body2'} foreground="hint-200">
          {compact
            ? '파일을 끌어다 놓거나 첨부하세요.'
            : '파일을 여기에 끌어다 놓거나 버튼으로 선택하세요.'}
        </Text>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={openFileDialog}
          aria-label="파일 선택"
        >
          파일 선택
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept?.join(',')}
          multiple={multiple}
          disabled={disabled}
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {lastRejection && (
        <Callout.Root colorPalette="danger" role="alert">
          <Text typography="body3">
            {lastRejection.fileName} — {describeRejection(lastRejection.reason)}
          </Text>
        </Callout.Root>
      )}
    </div>
  );
}
