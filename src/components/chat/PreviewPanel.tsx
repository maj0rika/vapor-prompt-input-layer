import { IconButton, Text } from '@vapor-ui/core';
import { CloseOutlineIcon } from '@vapor-ui/icons';
import { Markdown } from './Markdown';

export type PreviewPanelProps = {
  /** 에이전트가 작성 중/완료한 초안 문서. 스트리밍 중 점진 갱신된다. */
  draft: string;
  onClose: () => void;
};

/**
 * 에이전트가 작성·첨삭한 초안 문서의 라이브 렌더링 패널.
 *
 * 글쓰기 코치 도메인에서 split-panel 의 우측을 차지하며, 대화와 별개로
 * 결과 문서를 확인하는 역할을 한다.
 */
export function PreviewPanel({ draft, onClose }: PreviewPanelProps) {
  return (
    <aside
      aria-label="초안 미리보기"
      className="flex min-h-0 flex-col overflow-hidden border-t border-v-normal md:border-t-0 md:border-l"
    >
      <header className="flex items-center justify-between border-b border-v-normal px-v-200 py-v-150">
        <Text typography="subtitle2">초안 미리보기</Text>
        <IconButton
          size="sm"
          variant="ghost"
          aria-label="미리보기 닫기"
          onClick={onClose}
        >
          <CloseOutlineIcon size={16} />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-v-300">
        {draft ? (
          <div aria-live="polite">
            <Markdown>{draft}</Markdown>
          </div>
        ) : (
          <Text typography="body3" foreground="hint-200">
            에이전트가 초안을 작성하면 여기에 표시됩니다.
          </Text>
        )}
      </div>
    </aside>
  );
}
