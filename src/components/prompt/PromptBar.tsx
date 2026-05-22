import { useState } from 'react';
import { PromptBox } from './PromptBox';
import { Dropzone } from './Dropzone';
import { AttachmentList } from './AttachmentList';
import { DataSourceSelector } from './DataSourceSelector';
import type { DataSourceOption, PromptAttachment } from './types';

export type PromptSubmitPayload = {
  text: string;
  attachments: PromptAttachment[];
  dataSources: string[];
};

export type PromptBarProps = {
  dataSourceOptions: DataSourceOption[];
  multipleDataSources?: boolean;
  maxLength?: number;
  accept?: string[];
  maxFileSize?: number;
  multipleFiles?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /**
   * 입력창 초기 텍스트. 외부에서 텍스트를 주입하려면 `key` 와 함께 바꿔
   * 컴포넌트를 remount 한다 (예: 추천 칩 클릭).
   */
  defaultText?: string;
  onSubmit: (payload: PromptSubmitPayload) => void;
};

/** 업로드 완료까지의 모의 지연(ms). 데모에서 uploading → done 상태 전환을 보여준다. */
const UPLOAD_SIMULATION_MS = 700;

/**
 * Prompt Input 컴포넌트 레이어의 최상위 합성 컴포넌트.
 *
 * PromptBox / Dropzone / AttachmentList / DataSourceSelector 를 조립하고
 * 입력·첨부·데이터소스 상태를 한곳에서 관리한다.
 */
export function PromptBar({
  dataSourceOptions,
  multipleDataSources = false,
  maxLength = 1000,
  accept,
  maxFileSize,
  multipleFiles = true,
  disabled = false,
  placeholder = '무엇이든 물어보세요.',
  defaultText,
  onSubmit,
}: PromptBarProps) {
  const [text, setText] = useState(defaultText ?? '');
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [dataSources, setDataSources] = useState<string[]>([]);

  const markUploaded = (id: string) => {
    setAttachments((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'done' } : item,
      ),
    );
  };

  const handleFiles = (files: File[]) => {
    const incoming: PromptAttachment[] = files.map((file) => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      size: file.size,
      status: 'uploading',
    }));
    setAttachments((prev) => [...prev, ...incoming]);
    incoming.forEach((attachment) => {
      window.setTimeout(() => markUploaded(attachment.id), UPLOAD_SIMULATION_MS);
    });
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = () => {
    onSubmit({ text, attachments, dataSources });
    // 제출 후 입력 상태를 초기화한다. 데이터소스 선택은 설정값이므로 유지한다.
    setText('');
    setAttachments([]);
  };

  return (
    <div className="flex flex-col gap-3 rounded-v-400 border border-v-normal bg-v-canvas-100 p-v-300 sm:p-v-400">
      <DataSourceSelector
        options={dataSourceOptions}
        selected={dataSources}
        onChange={setDataSources}
        multiple={multipleDataSources}
        disabled={disabled}
      />

      <Dropzone
        accept={accept}
        maxSize={maxFileSize}
        multiple={multipleFiles}
        disabled={disabled}
        onFiles={handleFiles}
      />

      <AttachmentList
        attachments={attachments}
        onRemove={handleRemoveAttachment}
      />

      <PromptBox
        value={text}
        onValueChange={setText}
        onSubmit={handleSubmit}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}
