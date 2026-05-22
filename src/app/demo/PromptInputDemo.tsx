import { useState } from 'react';
import {
  PromptBar,
  type DataSourceOption,
  type PromptSubmitPayload,
} from '../../components/prompt';

const DATA_SOURCES: DataSourceOption[] = [
  { id: 'docs', label: '내 문서', description: '업로드한 문서에서 검색' },
  { id: 'web', label: '웹 검색', description: '최신 웹 결과 포함' },
  { id: 'code', label: '코드베이스', description: '연결된 저장소 검색' },
];

const ACCEPTED_TYPES = ['.png', '.jpg', '.jpeg', '.pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Prompt Input 컴포넌트 레이어의 사용 예시 화면.
 *
 * 앱 레이어는 제품 컴포넌트(PromptBar)만 사용하며 Vapor primitive 를
 * 직접 다루지 않는다.
 */
export function PromptInputDemo() {
  const [lastSubmit, setLastSubmit] = useState<PromptSubmitPayload | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-xl font-semibold">Prompt Input Layer</h1>
        <p className="m-0 text-sm text-gray-500">
          Vapor UI 기반 AI 챗 입력 컴포넌트 레이어 데모
        </p>
      </header>

      <PromptBar
        dataSourceOptions={DATA_SOURCES}
        multipleDataSources
        accept={ACCEPTED_TYPES}
        maxFileSize={MAX_FILE_SIZE}
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
            <dt className="text-gray-500">데이터소스</dt>
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
