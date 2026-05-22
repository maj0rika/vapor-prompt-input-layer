import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type MarkdownProps = {
  children: string;
};

/**
 * 어시스턴트 응답과 생성 artifact 를 마크다운으로 렌더링한다.
 *
 * 색상은 `.chat-md` 규칙에서 Vapor 테마 토큰을 상속하므로 다크 모드에
 * 자동으로 적응한다.
 */
export function Markdown({ children }: MarkdownProps) {
  return (
    <div className="chat-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
