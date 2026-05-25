import { useState } from 'react';
import {
  PromptBar,
  type PromptModeOption,
  type PromptSubmitPayload,
} from '../../components/prompt';

const MODE_OPTIONS: PromptModeOption[] = [
  { id: 'component', label: 'Component', description: 'React + TSX 생성' },
  { id: 'token-sync', label: 'Token Sync', description: '토큰 매핑' },
  { id: 'a11y-audit', label: 'A11y Audit', description: '접근성 점검' },
  { id: 'story-test', label: 'Story/Test', description: '스토리와 테스트' },
];

const ACCEPTED_TYPES = ['.json', '.ts', '.tsx', '.md', '.txt'];
const MAX_FILE_SIZE = 300 * 1024;

/**
 * Prompt Input 컴포넌트 레이어의 사용 예시 화면.
 *
 * 앱 레이어는 제품 컴포넌트(PromptBar)만 사용하며 Vapor primitive 를
 * 직접 다루지 않는다.
 */
export function PromptInputDemo() {
  const [lastSubmit, setLastSubmit] = useState<PromptSubmitPayload | null>(null);

  return (
    <div className="flex flex-col gap-v-200">
      <header className="flex flex-col gap-v-50">
        <h1 className="m-0 text-xl font-semibold">Automation Prompt Layer</h1>
        <p className="m-0 text-sm text-gray-500">
          Vapor DS 자동화 에이전트용 입력 컴포넌트 레이어 데모
        </p>
      </header>

      <PromptBar
        modeOptions={MODE_OPTIONS}
        accept={ACCEPTED_TYPES}
        maxFileSize={MAX_FILE_SIZE}
        maxFiles={5}
        maxLength={1000}
        onSubmit={setLastSubmit}
      />

      {lastSubmit && (
        <section
          aria-label="마지막 제출 결과"
          className="rounded-v-300 border border-v-normal p-v-300"
        >
          <h2 className="m-0 mb-2 text-sm font-semibold">제출됨</h2>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-gray-500">프롬프트</dt>
            <dd className="m-0 whitespace-pre-wrap break-words">
              {lastSubmit.text || '(빈 프롬프트)'}
            </dd>
            <dt className="text-gray-500">첨부</dt>
            <dd className="m-0">{lastSubmit.attachments.length}개</dd>
            <dt className="text-gray-500">모드</dt>
            <dd className="m-0">
              {lastSubmit.dataSources.length > 0
                ? lastSubmit.dataSources.join(', ')
                : '없음'}
            </dd>
          </dl>
        </section>
      )}
    </div>
  );
}
