import { type KeyboardEvent } from 'react';
import { Button, Text, Textarea } from '@vapor-ui/core';
import type { PromptBoxProps } from './types';

/**
 * 프롬프트 입력 · 제출 · 글자수를 담당하는 제품 컴포넌트.
 *
 * Vapor 의 Textarea / Button / Text 를 내부에서 합성하지만, 공개 API 는
 * 제품 요구사항(value, onSubmit, maxLength 등) 중심으로 정의한다.
 */
export function PromptBox({
  value,
  onValueChange,
  onSubmit,
  maxLength,
  disabled = false,
  placeholder,
  submitLabel = '보내기',
}: PromptBoxProps) {
  const charCount = value.length;
  const overLimit = maxLength != null && charCount > maxLength;
  const isEmpty = value.trim().length === 0;
  const canSubmit = !disabled && !isEmpty && !overLimit;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 제출 / Shift+Enter 줄바꿈. IME 조합 중 Enter 는 무시한다.
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    handleSubmit();
  };

  return (
    <div className="flex flex-col gap-v-100">
      <div className="flex items-end gap-v-100">
        <Textarea
          className="flex-1 min-w-0"
          value={value}
          onValueChange={(next) => onValueChange(next)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          invalid={overLimit}
          aria-label="프롬프트 입력"
          rows={3}
        />
        <Button
          type="button"
          colorPalette="primary"
          disabled={!canSubmit}
          onClick={handleSubmit}
          aria-label={submitLabel}
        >
          {submitLabel}
        </Button>
      </div>

      {maxLength != null && (
        <div className="flex justify-end min-h-[18px]">
          <Text
            typography="body3"
            foreground={overLimit ? 'danger-200' : 'hint-200'}
            aria-live="polite"
          >
            {charCount} / {maxLength}
          </Text>
        </div>
      )}
    </div>
  );
}
