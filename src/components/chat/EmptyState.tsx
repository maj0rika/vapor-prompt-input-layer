import { Button, Text } from '@vapor-ui/core';
import { AiSmartieOutlineIcon } from '@vapor-ui/icons';

const TEMPLATES = [
  {
    label: 'Primary Button',
    prompt: 'primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수',
  },
  {
    label: 'Data Table',
    prompt: '정렬 가능한 DataTable 컴포넌트와 Storybook story, Vitest 테스트 작성',
  },
  {
    label: 'Token Sync',
    prompt: 'Figma Variables JSON을 Vapor CSS token 매핑으로 변환하는 유틸 작성',
  },
  {
    label: 'A11y Fix',
    prompt: 'IconButton 접근성 결함을 Axe 기준으로 찾고 수정 코드와 테스트 작성',
  },
];

export type EmptyStateProps = {
  /** 템플릿 선택 시 호출 — 선택한 문구를 입력창에 채운다. */
  onPick: (suggestion: string) => void;
};

export function EmptyState({ onPick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4 p-v-400">
      <div className="flex max-w-[720px] gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-v-300 bg-v-primary-100 text-v-primary">
          <AiSmartieOutlineIcon size={20} aria-hidden="true" />
        </div>

        <div className="flex min-w-0 flex-col gap-3 rounded-v-400 border border-v-normal bg-v-canvas-100 p-v-300 shadow-sm">
          <div className="flex flex-col gap-1">
            <Text typography="subtitle1">무엇을 자동화할까요?</Text>
            <Text typography="body3" foreground="hint-200">
              Vapor 토큰을 지키는 컴포넌트, Storybook story, Vitest 테스트,
              Axe 접근성 체크까지 한 번에 생성합니다.
            </Text>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {TEMPLATES.map((template) => (
              <Button
                key={template.label}
                size="md"
                variant="outline"
                onClick={() => onPick(template.prompt)}
              >
                {template.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
