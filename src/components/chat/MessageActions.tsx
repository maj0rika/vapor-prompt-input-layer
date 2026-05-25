import { useEffect, useState } from 'react';
import { IconButton } from '@vapor-ui/core';
import {
  CheckCircleIcon,
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

/** 복사 완료 표시 유지 시간(ms). */
const COPIED_RESET_MS = 1600;

/**
 * 어시스턴트 메시지의 액션 — 복사 / 재생성(재시도) / 피드백 리액션.
 *
 * 복사 시 잠시 완료 상태를 표시하고, 피드백은 백엔드가 없으므로 로컬 토글
 * 상태로만 표현한다.
 */
export function MessageActions({ onCopy, onRegenerate }: MessageActionsProps) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const toggle = (value: Exclude<Feedback, null>) =>
    setFeedback((current) => (current === value ? null : value));

  const handleCopy = () => {
    onCopy();
    setCopied(true);
  };

  return (
    <div className="mt-v-50 flex items-center gap-v-25">
      <IconButton
        size="sm"
        variant="ghost"
        aria-label={copied ? '복사됨' : '응답 복사'}
        onClick={handleCopy}
      >
        {copied ? (
          <CheckCircleIcon size={15} />
        ) : (
          <CopyOutlineIcon size={15} />
        )}
      </IconButton>
      <span className="sr-only" aria-live="polite">
        {copied ? '응답이 복사되었습니다.' : ''}
      </span>

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
