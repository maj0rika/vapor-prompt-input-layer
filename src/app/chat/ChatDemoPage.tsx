import { ChatScreen } from '../../components/chat';
import type { DataSourceOption } from '../../components/prompt';

const DATA_SOURCES: DataSourceOption[] = [
  { id: 'my-docs', label: '내 문서', description: '업로드한 글에서 참고' },
  { id: 'style-guide', label: '문체 가이드', description: '톤·스타일 기준' },
  { id: 'web', label: '웹 검색', description: '최신 사례 포함' },
];

/**
 * AI 글쓰기 코치 에이전트 화면의 데모 페이지.
 *
 * 앱 레이어이므로 Vapor primitive 와 agent 내부 모듈을 직접 import 하지 않고,
 * 제품 컴포넌트(ChatScreen)만 사용한다.
 */
export function ChatDemoPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-xl font-semibold">글쓰기 코치</h1>
        <p
          className="m-0 text-sm"
          style={{ color: 'var(--vapor-color-foreground-hint-200)' }}
        >
          Vapor UI 기반 AI 에이전트 채팅 화면 — 컴포넌트 레이어 케이스 스터디
        </p>
      </header>
      <ChatScreen dataSourceOptions={DATA_SOURCES} />
    </div>
  );
}
