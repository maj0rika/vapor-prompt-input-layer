# Component API

Prompt Input Component Layer 의 공개 컴포넌트와 props 명세.
모든 props 는 Vapor primitive 가 아니라 제품 요구사항을 기준으로 정의한다.

## PromptBar

Vapor DS 자동화 요청을 입력하는 composer 컴포넌트. 모드 선택, 텍스트 입력,
첨부 파일 읽기, 제출 상태를 내부에서 관리한다.

| Prop | Type | Default | 설명 |
| --- | --- | --- | --- |
| `modeOptions` | `PromptModeOption[]` | 기본 4개 모드 | 자동화 mode 목록 |
| `defaultMode` | `AgentMode` | `'component'` | 초기 선택 mode |
| `maxLength` | `number` | `1600` | 프롬프트 최대 글자수 |
| `accept` | `string[]` | — | 허용 파일 형식 (확장자 / MIME) |
| `maxFileSize` | `number` | `300 * 1024` | 첨부 파일 최대 크기(byte) |
| `maxFiles` | `number` | `5` | 한 요청에 포함 가능한 최대 파일 수 |
| `multipleFiles` | `boolean` | `true` | 파일 다중 첨부 허용 |
| `disabled` | `boolean` | `false` | 전체 비활성화 |
| `placeholder` | `string` | DS 자동화 요청 문구 | 입력창 placeholder |
| `defaultText` | `string` | — | 템플릿 클릭 등으로 주입하는 초기 텍스트 |
| `bare` | `boolean` | `false` | 상위 surface 안에 끼울 때 card chrome 제거 |
| `onSubmit` | `(payload: PromptSubmitPayload) => void` | — | 제출 콜백 |

```ts
type PromptSubmitPayload = {
  text: string;
  attachments: PromptAttachment[];
  mode: AgentMode;
  dataSources: string[]; // legacy compatibility: selected mode id
};
```

## PromptModeSelector

자동화 실행 모드를 선택한다. 입력 전에 intent 를 고정해 prompt builder 와 검증
기준을 안정화한다.

```ts
type AgentMode = 'component' | 'token-sync' | 'a11y-audit' | 'story-test';

type PromptModeOption = {
  id: string;
  label: string;
  description?: string;
};
```

| Prop | Type | 설명 |
| --- | --- | --- |
| `options` | `PromptModeOption[]` | 선택 가능한 mode 목록 |
| `value` | `AgentMode` | 현재 mode |
| `onChange` | `(value: AgentMode) => void` | mode 변경 콜백 |
| `disabled` | `boolean` | 비활성화 |

## Attachments

첨부는 composer 내부 아이콘 버튼과 drag-and-drop 으로 처리한다. 텍스트 추출 가능한
파일만 1차 지원한다.

```ts
type PromptAttachment = {
  id: string;
  fileName: string;
  size: number;
  status: 'idle' | 'uploading' | 'done' | 'error';
  kind?: 'tokens' | 'component' | 'spec' | 'text';
  contentText?: string;
  truncated?: boolean;
  errorMessage?: string;
};
```

## PromptBox / Dropzone / DataSourceSelector

기존 단위 컴포넌트는 호환성과 테스트 케이스를 위해 남아 있다. 현재 메인 제품
화면은 별도 Dropzone 영역이나 DataSourceSelector 를 사용하지 않고, `PromptBar`
내부의 mode selector 와 inline attach control 을 사용한다.

## ChatScreen

대화 thread, artifact workspace, prompt composer 를 조립하는 제품 화면.

| Prop | Type | 설명 |
| --- | --- | --- |
| `modeOptions` | `PromptModeOption[]` | 앱 레이어가 주입하는 자동화 mode 목록 |
| `acceptedFileTypes` | `string[]` | 허용 첨부 확장자 |
| `maxFileSize` | `number` | 첨부 파일당 최대 크기 |
| `maxFiles` | `number` | 최대 첨부 개수 |
| `client` | `AgentClient` | 테스트/데모용 에이전트 클라이언트 주입점 |

## PreviewPanel

생성물을 Component / Story / Test / Validation 탭으로 보여주는 artifact workspace.
대화 텍스트와 코드 산출물을 분리해 검토 속도를 높인다.
