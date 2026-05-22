import { Button, Text } from '@vapor-ui/core';
import { MagicWandIcon } from '@vapor-ui/icons';

/** 글쓰기 코치 도메인의 워크플로우 추천 칩. */
const SUGGESTIONS = [
  '이 문장 좀 다듬어줘',
  '블로그 글 초안 작성해줘',
  '제목 추천해줘',
];

export type EmptyStateProps = {
  /** 추천 칩 선택 시 호출 — 선택한 문구를 입력창에 채운다. */
  onPick: (suggestion: string) => void;
};

/**
 * 대화가 비어 있을 때의 안내 화면. 워크플로우 추천 칩을 제공한다.
 */
export function EmptyState({ onPick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-v-500 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-v-primary-100 text-v-primary">
        <MagicWandIcon size={26} aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-1">
        <Text typography="heading5">무엇을 도와드릴까요?</Text>
        <Text typography="body3" foreground="hint-200">
          문장 다듬기, 초안 작성, 제목 추천 — 글쓰기 전 과정을 도와드립니다.
        </Text>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            size="sm"
            variant="outline"
            onClick={() => onPick(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}
