import { useMemo, useState } from 'react';
import { Badge, Button, IconButton, Text } from '@vapor-ui/core';
import { CloseOutlineIcon, CopyOutlineIcon } from '@vapor-ui/icons';
import { Markdown } from './Markdown';

type ArtifactTab = 'component' | 'story' | 'test' | 'validation';

type ArtifactSection = {
  id: ArtifactTab;
  label: string;
  content: string;
};

export type PreviewPanelProps = {
  /** 에이전트가 작성 중/완료한 생성 artifact. 스트리밍 중 점진 갱신된다. */
  draft: string;
  onClose: () => void;
  canClose?: boolean;
};

const TAB_LABELS: Record<ArtifactTab, string> = {
  component: 'Component',
  story: 'Story',
  test: 'Test',
  validation: 'Validation',
};

/**
 * DS 자동화 에이전트가 만든 산출물을 검토하는 artifact workspace.
 *
 * 대화는 의사결정 기록이고, 이 패널은 실제 생성물을 탭 단위로 검토하는 영역이다.
 */
export function PreviewPanel({ draft, onClose, canClose = true }: PreviewPanelProps) {
  const sections = useMemo(() => parseArtifactSections(draft), [draft]);
  const [activeTab, setActiveTab] = useState<ArtifactTab>('component');
  const active = sections.find((section) => section.id === activeTab) ?? sections[0];
  const validation = sections.find((section) => section.id === 'validation');

  const handleCopy = () => {
    if (!active) return;
    void navigator.clipboard?.writeText(active.content);
  };

  return (
    <aside
      aria-label="생성물 워크스페이스"
      className="flex min-h-0 flex-col overflow-hidden border-t border-v-normal bg-v-canvas-100 md:border-t-0 md:border-l"
    >
      <header className="flex items-center justify-between border-b border-v-normal px-v-200 py-v-150">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Text typography="subtitle2">Artifact workspace</Text>
          <Text typography="body4" foreground="hint-200">
            generated Vapor component package
          </Text>
        </div>
        <div className="flex items-center gap-1">
          {active && (
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={`${active.label} 복사`}
              onClick={handleCopy}
            >
              <CopyOutlineIcon size={16} />
            </IconButton>
          )}
          {canClose && (
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="워크스페이스 닫기"
              onClick={onClose}
            >
              <CloseOutlineIcon size={16} />
            </IconButton>
          )}
        </div>
      </header>

      {sections.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-v-normal px-v-200 py-v-150">
          {sections.map((section) => (
            <Button
              key={section.id}
              size="sm"
              variant={section.id === active?.id ? 'outline' : 'ghost'}
              colorPalette="primary"
              aria-current={section.id === active?.id ? 'page' : undefined}
              onClick={() => setActiveTab(section.id)}
            >
              {section.label}
            </Button>
          ))}
        </div>
      )}

      {validation && (
        <div className="flex flex-wrap gap-1 border-b border-v-normal px-v-200 py-v-150">
          {extractValidationBadges(validation.content).map((item) => (
            <Badge
              key={item.label}
              size="sm"
              colorPalette={item.pass ? 'success' : 'danger'}
            >
              {item.label}: {item.pass ? 'PASS' : 'CHECK'}
            </Badge>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-v-300">
        {active ? (
          <div aria-live="polite">
            <Markdown>{active.content}</Markdown>
          </div>
        ) : (
          <div className="flex h-full flex-col justify-between gap-v-400">
            <div className="flex flex-col gap-v-100">
              <Text typography="subtitle2">아직 생성된 artifact가 없습니다.</Text>
              <Text typography="body3" foreground="hint-200">
                Component, Story, Test, Validation 결과가 이곳에 정리됩니다.
              </Text>
            </div>
            <div className="grid gap-v-100 text-sm">
              {['React + TypeScript', 'Storybook story', 'Vitest test', 'Axe + token check'].map(
                (item) => (
                  <div
                    key={item}
                    className="rounded-v-200 border border-v-normal px-v-200 py-v-150"
                  >
                    {item}
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function parseArtifactSections(markdown: string): ArtifactSection[] {
  if (!markdown.trim()) return [];

  const matches = [...markdown.matchAll(/^##\s+(Component|Story|Test|Validation)\s*$/gim)];
  if (matches.length === 0) {
    return [{ id: 'component', label: 'Component', content: markdown }];
  }

  return matches.map((match, index) => {
    const title = match[1].toLowerCase() as ArtifactTab;
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    const content = markdown.slice(start, end).trim();
    return {
      id: title,
      label: TAB_LABELS[title],
      content: `## ${TAB_LABELS[title]}\n\n${content}`,
    };
  });
}

function extractValidationBadges(content: string): Array<{ label: string; pass: boolean }> {
  const labels = ['Typecheck', 'Unit', 'Axe', 'Vapor token usage'];
  return labels.map((label) => ({
    label,
    pass: new RegExp(`${escapeRegExp(label)}\\s*:\\s*PASS`, 'i').test(content),
  }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
