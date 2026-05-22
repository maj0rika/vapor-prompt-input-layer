import { useState } from 'react';
import { IconButton } from '@vapor-ui/core';
import {
  CopyOutlineIcon,
  DislikeThumbIcon,
  DislikeThumbOutlineIcon,
  LikeThumbIcon,
  LikeThumbOutlineIcon,
  RefreshOutlineIcon,
} from '@vapor-ui/icons';

export type MessageActionsProps = {
  onCopy: () => void;
  /** 미지정 시 재생성 버튼을 숨긴다. */
  onRegenerate?: () => void;
};

type Feedback = 'up' | 'down' | null;

/**
 * 어시스턴트 메시지의 액션 — 복사 / 재생성(재시도) / 피드백 리액션.
 *
 * 피드백은 백엔드가 없으므로 로컬 토글 상태로만 표현한다.
 */
export function MessageActions({ onCopy, onRegenerate }: MessageActionsProps) {
  const [feedback, setFeedback] = useState<Feedback>(null);

  const toggle = (value: Exclude<Feedback, null>) =>
    setFeedback((current) => (current === value ? null : value));

  return (
    <div className="mt-1 flex items-center gap-0.5">
      <IconButton
        size="sm"
        variant="ghost"
        aria-label="응답 복사"
        onClick={onCopy}
      >
        <CopyOutlineIcon size={15} />
      </IconButton>

      {onRegenerate && (
        <IconButton
          size="sm"
          variant="ghost"
          aria-label="응답 재생성"
          onClick={onRegenerate}
        >
          <RefreshOutlineIcon size={15} />
        </IconButton>
      )}

      <IconButton
        size="sm"
        variant="ghost"
        aria-label="도움이 됐어요"
        aria-pressed={feedback === 'up'}
        onClick={() => toggle('up')}
      >
        {feedback === 'up' ? (
          <LikeThumbIcon size={15} />
        ) : (
          <LikeThumbOutlineIcon size={15} />
        )}
      </IconButton>

      <IconButton
        size="sm"
        variant="ghost"
        aria-label="아쉬워요"
        aria-pressed={feedback === 'down'}
        onClick={() => toggle('down')}
      >
        {feedback === 'down' ? (
          <DislikeThumbIcon size={15} />
        ) : (
          <DislikeThumbOutlineIcon size={15} />
        )}
      </IconButton>
    </div>
  );
}
