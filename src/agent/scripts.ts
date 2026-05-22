/**
 * 글쓰기 코치 도메인의 모의 응답 스크립트.
 *
 * 실제 LLM 대신 입력 키워드로 미리 작성된 스크립트를 선택한다.
 * `draft` 가 있으면 PreviewPanel 에 초안 문서로 렌더링된다.
 */

export type AgentScript = {
  /** 어시스턴트 응답 본문. */
  reply: string;
  /** PreviewPanel 에 렌더링할 초안 문서. */
  draft?: string;
  /** 설정 시 본문 일부를 흘린 뒤 오류로 종료한다 (오류 경로 테스트용). */
  error?: string;
};

const REVISE: AgentScript = {
  reply:
    '문장을 다듬어 봤어요. 주요 변경은 다음과 같습니다.\n\n' +
    '- **주어를 앞세워** 문장의 초점을 분명히 했습니다\n' +
    '- 불필요한 수식어를 덜어 읽는 호흡을 줄였습니다\n' +
    '- 한 문장에 담긴 정보를 두 문장으로 나눴습니다\n\n' +
    '오른쪽 패널에서 수정본을 확인하세요.',
  draft:
    '## 제안 수정본\n\n' +
    '우리 팀은 이번 분기에 신규 사용자 **온보딩 흐름**을 다시 설계했습니다. ' +
    '그 결과 첫 주 이탈률이 눈에 띄게 줄었고, 핵심 기능 사용률은 높아졌습니다.\n\n' +
    '> 원문은 한 문장에 정보가 많아 호흡이 길었습니다.',
};

const DRAFT: AgentScript = {
  reply:
    '요청하신 글의 초안을 작성했어요. 다음 구조로 잡았습니다.\n\n' +
    '1. **도입** — 독자의 문제의식을 먼저 건드립니다\n' +
    '2. **본문** — 해결책을 구체적으로 제시합니다\n' +
    '3. **마무리** — 핵심 메시지를 한 문장으로 남깁니다\n\n' +
    '오른쪽 패널의 초안을 검토해 주세요.',
  draft:
    '## 초안\n\n' +
    '좋은 글은 정보를 나열하지 않습니다. 좋은 글은 독자가 **다음 문장을 읽고 싶게** ' +
    '만듭니다.\n\n' +
    '그 차이는 문장력이 아니라 구조에서 옵니다.',
};

const TITLE: AgentScript = {
  reply:
    '제목 후보를 뽑아 봤어요.\n\n' +
    '1. **직관형** — 글의 내용을 그대로 요약\n' +
    '2. **호기심형** — 독자가 답을 궁금하게 만드는 문장\n' +
    '3. **검색형** — 핵심 키워드를 앞쪽에 배치\n\n' +
    '글의 톤에 맞춰 골라 보세요.',
};

const DEFAULT: AgentScript = {
  reply:
    '글쓰기와 관련해 무엇이든 도와드릴게요. 이런 것들을 할 수 있습니다.\n\n' +
    '- 문장 **다듬기** 와 첨삭\n' +
    '- 글의 **초안 작성**\n' +
    '- **제목** 후보 제안\n\n' +
    '어떤 글을 쓰고 계신지 알려주세요.',
};

const ERROR: AgentScript = {
  reply: '요청을 처리하는 중에',
  error: '응답 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.',
};

/** 입력 텍스트의 키워드로 모의 응답 스크립트를 선택한다. */
export function selectScript(input: string): AgentScript {
  const text = input.toLowerCase();
  if (/에러|error|실패/.test(text)) return ERROR;
  if (/다듬|고쳐|첨삭|개선|revise/.test(text)) return REVISE;
  if (/써줘|작성|초안|draft|write/.test(text)) return DRAFT;
  if (/제목|title|헤드라인/.test(text)) return TITLE;
  return DEFAULT;
}
