import { Button, Text } from '@vapor-ui/core';
import { AiSmartieOutlineIcon } from '@vapor-ui/icons';
import type { TemplateKey } from '../../agent';

type TemplateItem = {
  label: string;
  prompt: string;
  output: string;
  gates: string;
  templateKey: TemplateKey;
};

const TEMPLATES: TemplateItem[] = [
  {
    label: 'Primary Button',
    prompt: 'primary 버튼 컴포넌트 생성, dark mode 지원, Vapor 토큰 준수',
    output: 'PrimaryActionButton.tsx · story · Vitest · Axe',
    gates: 'Typecheck, Unit, Runtime, Axe, Token',
    templateKey: 'primary-button',
  },
  {
    label: 'Data Table',
    prompt: '정렬 가능한 DataTable 컴포넌트와 Storybook story, Vitest 테스트 작성',
    output: 'DataTable.tsx · sortable story · row-state tests',
    gates: 'Loading, empty, error, keyboard states',
    templateKey: 'data-table',
  },
  {
    label: 'Token Sync',
    prompt: 'Figma Variables JSON을 Vapor CSS token 매핑으로 변환하는 유틸 작성',
    output: 'token map utility · mapping story · unit tests',
    gates: 'Raw color, spacing, radius checks',
    templateKey: 'token-sync',
  },
  {
    label: 'A11y Fix',
    prompt: 'IconButton 접근성 결함을 Axe 기준으로 찾고 수정 코드와 테스트 작성',
    output: 'accessible TSX patch · axe-focused tests',
    gates: 'Role, name, keyboard, disabled states',
    templateKey: 'a11y-fix',
  },
  {
    label: 'Story/Test',
    prompt: '기존 컴포넌트에 대한 Storybook story와 Vitest 테스트 생성',
    output: 'story · Vitest · coverage',
    gates: 'Unit, Story render, A11y',
    templateKey: 'story-test',
  },
];

const WORKFLOW_STEPS = [
  'Choose task',
  'Attach spec/token/source',
  'Generate artifact',
  'Validate gates',
  'Repair or approve',
];

export type EmptyStateProps = {
  /** 템플릿 선택 시 호출 — templateKey 로 deterministic fixture 를 로드한다. */
  onPick: (templateKey: TemplateKey) => void;
  /** deterministic sample 을 모델 호출 없이 workbench 에 로드한다. */
  onRunVerifiedSample: () => void;
};

export function EmptyState({ onPick, onRunVerifiedSample }: EmptyStateProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-start gap-v-200 overflow-y-auto p-v-400 pb-v-700 pt-v-500">
      <div className="grid max-w-[820px] gap-v-300">
        <div className="grid gap-v-100 rounded-v-300 border border-v-normal bg-v-canvas-100 p-v-300">
          <Text typography="subtitle2">Workbench ready</Text>
          <div className="grid gap-v-100 sm:grid-cols-5">
            {WORKFLOW_STEPS.map((step, index) => (
              <div
                key={step}
                className="flex min-h-[72px] flex-col gap-v-50 rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-150 py-v-100"
              >
                <Text typography="body4" foreground="hint-200">
                  {index + 1}
                </Text>
                <Text typography="body4">{step}</Text>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-v-150">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-v-300 bg-v-primary-100 text-v-primary">
            <AiSmartieOutlineIcon size={20} aria-hidden="true" />
          </div>

          <div className="flex min-w-0 flex-col gap-v-150 rounded-v-400 border border-v-normal bg-v-canvas-100 p-v-300 shadow-sm">
            <div className="flex flex-col gap-v-50">
              <Text typography="subtitle1">무엇을 자동화할까요?</Text>
              <Text typography="body3" foreground="hint-200">
                Vapor 토큰을 지키는 컴포넌트, Storybook story, Vitest 테스트,
                Axe 접근성 체크까지 한 번에 생성합니다.
              </Text>
            </div>

            <div className="grid gap-v-150 rounded-v-300 border border-v-primary bg-v-primary-100 p-v-200">
              <div className="flex min-w-0 flex-col gap-v-50">
                <Text typography="subtitle2">Verified sample run</Text>
                <Text typography="body4" foreground="hint-200">
                  deterministic fixture · no DeepSeek call · same parser, Canvas
                  runtime, and validation runner
                </Text>
              </div>
              <Button
                size="md"
                colorPalette="primary"
                onClick={onRunVerifiedSample}
              >
                Run verified sample
              </Button>
            </div>

            <div className="grid gap-v-100 sm:grid-cols-2">
              {TEMPLATES.map((template) => (
                <Button
                  key={template.label}
                  size="md"
                  variant="outline"
                  onClick={() => onPick(template.templateKey)}
                >
                  <span className="flex min-w-0 flex-col items-start gap-v-50 text-left">
                    <span>{template.label}</span>
                    <span className="text-xs font-normal text-v-hint">{template.output}</span>
                    <span className="text-xs font-normal text-v-hint">{template.gates}</span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
