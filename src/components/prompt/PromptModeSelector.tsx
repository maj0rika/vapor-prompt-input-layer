import { Select } from '@vapor-ui/core';
import type { AgentMode, PromptModeSelectorProps } from './types';

/**
 * DS 자동화 요청의 실행 모드를 고른다.
 *
 * 입력 전 intent 를 고정하면 LLM 프롬프트와 검증 기준이 같이 안정된다.
 */
export function PromptModeSelector({
  options,
  value,
  onChange,
  disabled = false,
}: PromptModeSelectorProps) {
  const items = options.map((option) => ({
    label: option.label,
    value: option.id,
  }));

  return (
    <Select.Root
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(next) => onChange(next as AgentMode)}
    >
      <Select.Trigger aria-label="자동화 모드 선택" />
      <Select.Popup>
        {options.map((option) => (
          <Select.Item key={option.id} value={option.id}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  );
}
