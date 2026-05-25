import { MultiSelect, Select, Text } from '@vapor-ui/core';
import type { DataSourceSelectorProps } from './types';

/**
 * AI 답변 생성에 사용할 데이터소스를 선택하는 제품 컴포넌트.
 *
 * `multiple` 여부에 따라 Vapor 의 Select / MultiSelect 를 사용하지만,
 * 공개 API 는 항상 문자열 배열(`selected`)로 통일한다.
 */
export function DataSourceSelector({
  options,
  selected,
  onChange,
  multiple = false,
  disabled = false,
}: DataSourceSelectorProps) {
  const items = options.map((option) => ({
    label: option.label,
    value: option.id,
  }));

  const selectedLabels = options
    .filter((option) => selected.includes(option.id))
    .map((option) => option.label);

  const summary =
    selectedLabels.length > 0
      ? selectedLabels.join(', ')
      : '선택된 데이터소스 없음';

  return (
    <div className="flex flex-col gap-v-50">
      <Text typography="body3" foreground="hint-200">
        데이터소스
      </Text>

      {multiple ? (
        <MultiSelect.Root
          items={items}
          placeholder="데이터소스 선택"
          value={selected}
          disabled={disabled}
          onValueChange={(next) => onChange((next as string[]) ?? [])}
        >
          <MultiSelect.Trigger aria-label="데이터소스 선택" />
          <MultiSelect.Popup>
            {options.map((option) => (
              <MultiSelect.Item key={option.id} value={option.id}>
                {option.label}
              </MultiSelect.Item>
            ))}
          </MultiSelect.Popup>
        </MultiSelect.Root>
      ) : (
        <Select.Root
          items={items}
          placeholder="데이터소스 선택"
          value={selected[0] ?? ''}
          disabled={disabled}
          onValueChange={(next) => {
            const value = next as string;
            onChange(value ? [value] : []);
          }}
        >
          <Select.Trigger aria-label="데이터소스 선택" />
          <Select.Popup>
            {options.map((option) => (
              <Select.Item key={option.id} value={option.id}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Root>
      )}

      <Text typography="body3" foreground="hint-200" aria-live="polite">
        {summary}
      </Text>
    </div>
  );
}
