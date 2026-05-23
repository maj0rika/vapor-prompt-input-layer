import type { ReactNode } from 'react';

export type MarkdownProps = {
  children: string;
};

type Block =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; language: string; code: string }
  | { type: 'paragraph'; text: string };

/**
 * 어시스턴트 응답과 생성 artifact 에 필요한 최소 Markdown subset 렌더러.
 *
 * 지원 범위는 heading, bullet list, fenced code, paragraph 로 제한한다.
 * 외부 markdown parser 를 제거해 초기 JS bundle 을 줄이고, LLM 출력은 React
 * text node 로 렌더해 HTML injection 표면을 만들지 않는다.
 */
export function Markdown({ children }: MarkdownProps) {
  return <div className="chat-md">{parseBlocks(children).map(renderBlock)}</div>;
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.type) {
    case 'heading':
      return block.level === 2 ? (
        <h2 key={index}>{block.text}</h2>
      ) : (
        <h3 key={index}>{block.text}</h3>
      );
    case 'list':
      return (
        <ul key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case 'code':
      return (
        <pre key={index}>
          <code data-language={block.language}>{block.code}</code>
        </pre>
      );
    case 'paragraph':
      return <p key={index}>{renderInline(block.text)}</p>;
  }
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] | null = null;
  let codeLanguage = '';

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    blocks.push({ type: 'list', items: list });
    list = [];
  };

  for (const line of lines) {
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      if (code) {
        blocks.push({ type: 'code', language: codeLanguage, code: code.join('\n') });
        code = null;
        codeLanguage = '';
      } else {
        flushParagraph();
        flushList();
        code = [];
        codeLanguage = fence[1] ?? '';
      }
      continue;
    }

    if (code) {
      code.push(line);
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', level: 3, text: line.slice(4) });
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', level: 2, text: line.slice(3) });
      continue;
    }

    if (line.startsWith('- ')) {
      flushParagraph();
      list.push(line.slice(2));
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }

    paragraph.push(line);
  }

  if (code) {
    blocks.push({ type: 'code', language: codeLanguage, code: code.join('\n') });
  }
  flushParagraph();
  flushList();
  return blocks;
}
