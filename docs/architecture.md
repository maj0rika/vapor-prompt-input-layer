# Architecture

## 개요

이 프로젝트는 AI 에이전트 채팅 화면을, 화면 하나가 아니라 **경계가 강제된
레이어 구조**로 설계한 케이스 스터디다. Vapor primitive 를 제품 컴포넌트
레이어로 감싸고, React 와 분리된 순수 에이전트 엔진을 두며, 레이어 간 import
경계를 ESLint 로 강제한다.

## 레이어 구조

```
@vapor-ui/core              ← 디자인시스템 primitive
        ↓
Product Component Layer     ← src/components/prompt/**, src/components/chat/**
        ↓
Demo App                    ← src/app/**

src/agent/**                ← 모의 에이전트 엔진 (UI 무관 순수 로직)
```

| 레이어 | 위치 | 책임 |
| --- | --- | --- |
| Vapor primitive | `@vapor-ui/core` | 접근성·테마·스타일을 갖춘 기본 UI 단위 |
| Product Component Layer | `src/components/prompt/**`, `src/components/chat/**` | Vapor primitive 를 제품 요구사항에 맞게 합성·래핑 |
| Demo App | `src/app/**` | 제품 컴포넌트를 조립해 실제 화면을 구성 |
| Agent Engine | `src/agent/**` | 모의 스트리밍·상태머신 — React/DOM 무관 순수 로직 |

## 경계 규칙 (ESLint 로 강제하는 2종)

경계는 문서 권고가 아니라 `eslint.config.js` 의 `no-restricted-imports` 로
강제된다. 위반 시 `npm run lint` 가 실패한다.

### 1. Vapor 경계

`@vapor-ui/core` 직접 import 는 `src/**` 전역에서 차단되고, 허용 소비처를
**명시적으로 열거**해 해제한다.

- 허용: `src/components/prompt/**`, `src/components/chat/**`, `src/main.tsx`
- 금지: `src/app/**`, `src/agent/**` 등 그 외 전역

레이어를 추가하려면 이 열거 목록에 한 줄을 더해야 하므로, 경계 결정이 항상
diff 에 드러난다.

### 2. agent-internal 경계

`src/agent/**` 엔진은 배럴(`src/agent/index.ts`)로만 노출된다.

- `src/app/**`, `src/components/chat/**` 는 `src/agent` 배럴만 import 가능
- `src/agent/MockAgentClient` 등 내부 모듈 deep import 는 ESLint error

이로써 엔진의 내부 구조가 캡슐화되고, 공개 표면이 배럴 하나로 고정된다.

### 분리의 목적

- Vapor / 엔진 내부 API 변경 시 수정 범위를 해당 레이어로 한정
- 제품 전반의 UI 사용 패턴을 일관화
- 접근성·상태·검증 로직을 단일 지점에서 관리
- 디자인시스템 · 제품 컴포넌트 · 순수 로직의 책임을 명확히 구분

## 에이전트 엔진 (`src/agent/**`)

백엔드 없이 동작하는 모의 스트리밍 엔진. React 에 의존하지 않으므로 단독으로
단위 테스트된다.

- `AgentClient` — `sendMessage(request, signal): AsyncIterable<AgentEvent>`
  인터페이스. 실제 백엔드 클라이언트로 교체 가능.
- `MockAgentClient` — `async function*` 제너레이터로 도메인 스크립트를 토큰
  단위로 지연 방출 (SSE 흉내).
- `messageMachine` — 순수 상태머신 `idle → streaming → done | error | cancelled`.
- **Teardown 계약** — `sendMessage` 는 `AbortSignal` 을 받는다. 소비 훅
  `useAgentStream` 이 send 마다 `AbortController` 를 소유하고, 언마운트·재send
  시 abort 한다. 언마운트 후에는 상태를 갱신하지 않는다.

## 컴포넌트 구성

```
ChatScreen                  채팅 화면 최상위 합성 (헤더·본문·입력 통합 surface)
├─ ConversationView         메시지 thread 스크롤 컨테이너
│  └─ MessageBubble         user/assistant 버블
│     ├─ MessageAvatar      발신자 아바타
│     ├─ AttachmentChip     함께 전송된 첨부 파일 칩
│     ├─ Markdown           어시스턴트 응답 마크다운 렌더링
│     └─ MessageActions     복사(완료 피드백) / 재생성 / 피드백
├─ PreviewPanel             에이전트 초안 문서 라이브 렌더링 (Markdown)
├─ EmptyState               빈 상태 + 워크플로우 추천 칩
├─ ThemeToggle              라이트/다크 모드 전환
└─ PromptBar                입력 영역 (prompt 레이어 재사용, bare 모드)
   ├─ PromptBox · Dropzone · AttachmentList · DataSourceSelector
```

- 사용자가 첨부한 파일은 `ChatMessage.attachments` 로 보존되어 대화 버블에
  칩으로 표시된다. 메시지는 `createdAt` 타임스탬프와 발신자 아바타를 가진다.
- 어시스턴트 응답과 초안은 `react-markdown` 으로 렌더링하며, 색상은
  `.chat-md` 규칙에서 Vapor 테마 토큰을 상속해 다크 모드에 적응한다.

## 스타일링

스타일은 Tailwind CSS v4 와 Vapor UI 의 Tailwind 프리셋을 함께 사용한다.

- `@vapor-ui/core/tailwind.css` 프리셋이 Vapor 디자인 토큰을 `v-` 접두사
  유틸리티(`bg-v-canvas-100`, `gap-v-200` 등)로 노출한다.
- CSS `@layer` 우선순위는 `tw-theme → vapor → tw-utilities` 순서.
- Vapor 가 자체 CSS reset 을 포함하므로 Tailwind preflight 는 쓰지 않는다.
- 다크 모드는 Vapor `ThemeProvider` + `useTheme` 로 전환하며, 시맨틱 토큰이
  자동으로 라이트/다크 값에 매핑된다.

## Props 설계 원칙

Vapor primitive 의 props 를 그대로 외부로 노출하지 않는다. 제품 컴포넌트의
공개 API 는 Vapor 내부 구조와 무관하게 제품 언어(`value`, `onSubmit`,
`disabled`, `status` 등)로 정의한다. 앱은 Vapor 를 몰라도 제품 컴포넌트를
사용할 수 있어야 한다.
