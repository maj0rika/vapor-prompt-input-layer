import { Suspense, lazy, useState } from 'react';
import { Button, Text } from '@vapor-ui/core';
import { AiSmartieOutlineIcon } from '@vapor-ui/icons';
import type { TemplateKey } from '../../agent';

// 사용 설명서는 사용자가 열 때만 mount → 초기 JS bundle 예산 (200KB gzip) 보호.
const UsageGuide = lazy(() =>
  import('./UsageGuide').then((m) => ({ default: m.UsageGuide })),
);

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
  '작업 선택',
  '문서·토큰·코드 첨부',
  'Artifact 생성',
  '검증 게이트 실행',
  '보수 또는 승인',
];

export type EmptyStateProps = {
  /** 템플릿 선택 시 호출 — templateKey 로 deterministic fixture 를 로드한다. */
  onPick: (templateKey: TemplateKey) => void;
  /** deterministic sample 을 모델 호출 없이 workbench 에 로드한다. */
  onRunVerifiedSample: () => void;
  /**
   * 자연어 예시 칩 선택 시 호출 — fixture 로드 없이 PromptBar 입력창만 채운다.
   * 미지정 시 자연어 섹션을 숨긴다.
   */
  onPickPromptText?: (text: string) => void;
};

/** 자연어로 직접 입력해 시작할 수 있는 예시 prompt. */
const NL_PROMPTS = [
  'Vapor primary 버튼 컴포넌트 생성, dark mode 지원, Tooltip 포함',
  'sticky header 가 있는 DataTable 컴포넌트, 정렬·페이지네이션 포함',
  '첨부한 IconButton 의 a11y 결함 찾아서 fix 코드와 axe 테스트 작성',
  'Figma Variables JSON 을 Vapor token CSS 로 변환하는 utility',
];

export function EmptyState({
  onPick,
  onRunVerifiedSample,
  onPickPromptText,
}: EmptyStateProps) {
  const [showUsage, setShowUsage] = useState(false);
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-start gap-v-200 overflow-y-auto p-v-400 pb-v-700 pt-v-500">
      <div className="grid max-w-[820px] gap-v-300">
        <div className="grid gap-v-100 rounded-v-300 border border-v-normal bg-v-canvas-100 p-v-300">
          <Text typography="subtitle2">5단계 작업 흐름</Text>
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
                <Text typography="subtitle2">검증된 샘플 바로 보기</Text>
                <Text typography="body4" foreground="hint-200">
                  결정적 fixture · DeepSeek 호출 없음 · 실제 파서·Canvas
                  런타임·검증 러너를 그대로 사용
                </Text>
              </div>
              <Button
                size="md"
                colorPalette="primary"
                onClick={onRunVerifiedSample}
              >
                검증 샘플 실행
              </Button>
            </div>

            {onPickPromptText && (
              <div className="flex flex-col gap-v-100">
                <Text typography="subtitle2">자연어 예시</Text>
                <Text typography="body4" foreground="hint-200">
                  클릭하면 아래 입력창이 자동으로 채워집니다. 그대로 보내거나
                  자유롭게 수정하세요. (실제 DeepSeek 호출 → 새 artifact 생성)
                </Text>
                <div className="flex flex-wrap gap-v-50">
                  {NL_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => onPickPromptText(prompt)}
                      className="rounded-v-200 border border-v-normal bg-v-canvas-100 px-v-150 py-v-100 text-left text-xs transition-colors hover:border-v-primary hover:bg-v-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v-primary"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-v-100 sm:grid-cols-2">
              {TEMPLATES.map((template) => (
                <button
                  key={template.label}
                  type="button"
                  onClick={() => onPick(template.templateKey)}
                  className="flex min-w-0 flex-col items-start gap-v-50 rounded-v-300 border border-v-normal bg-v-canvas-100 p-v-200 text-left transition-colors hover:border-v-primary hover:bg-v-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v-primary"
                >
                  <span className="text-sm font-medium">{template.label}</span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--vapor-color-foreground-hint-200)' }}
                  >
                    {template.output}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--vapor-color-foreground-hint-200)' }}
                  >
                    {template.gates}
                  </span>
                </button>
              ))}
            </div>

            <div className="rounded-v-300 border border-v-normal bg-v-canvas-200 p-v-200">
              <button
                type="button"
                onClick={() => setShowUsage((open) => !open)}
                aria-expanded={showUsage}
                aria-controls="empty-state-usage-guide"
                className="flex w-full items-center justify-between gap-v-100 text-left text-sm font-medium"
              >
                <span>자세한 사용 설명서</span>
                <span aria-hidden="true">{showUsage ? '▾' : '▸'}</span>
              </button>
              {showUsage && (
                <div id="empty-state-usage-guide">
                  <Suspense
                    fallback={
                      <Text
                        typography="body4"
                        foreground="hint-200"
                        className="mt-v-150 block"
                      >
                        설명서를 불러오는 중...
                      </Text>
                    }
                  >
                    <UsageGuide />
                  </Suspense>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
