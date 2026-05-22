# Architecture

## 개요

이 프로젝트는 Vapor Design System 기반 반복 작업을 자연어 에이전트로 자동화하는
케이스 스터디다. 사용자는 DS 작업 요청과 참고 파일을 입력하고, 에이전트는
컴포넌트, Storybook story, Vitest test, 접근성/token notes 를 생성한다.

중요한 구조 원칙은 세 가지다.

- Vite config 는 dev server wiring 만 담당한다.
- prompt builder, artifact parser, token checker 는 `src/agent/**` 의 순수 모듈로
  분리한다.
- 브라우저는 same-origin API 만 호출하고 DeepSeek API key 는 서버 프록시에서만
  읽는다.

## 레이어 구조

```txt
@vapor-ui/core              ← 디자인시스템 primitive
        ↓
Product Component Layer     ← src/components/prompt/**, src/components/chat/**
        ↓
Demo App                    ← src/app/**

src/agent/**                ← AgentClient, prompt builder, parser, token checker
server/deepseek/**          ← 서버 전용 DeepSeek proxy
```

| 레이어 | 위치 | 책임 |
| --- | --- | --- |
| Vapor primitive | `@vapor-ui/core` | 접근성·테마·스타일을 갖춘 기본 UI 단위 |
| Product Component Layer | `src/components/**` | Vapor primitive 를 제품 요구사항에 맞게 합성·래핑 |
| Demo App | `src/app/**` | 제품 컴포넌트를 조립해 실제 화면을 구성 |
| Agent Core | `src/agent/**` | 클라이언트 계약, prompt 구성, SSE/parser/token check |
| Server Proxy | `server/deepseek/**` | API key 보호, DeepSeek payload 구성, stream forwarding |

## Agent Flow

```txt
PromptBar submit
  → AgentRequest { text, mode, attachments }
  → DeepSeekAgentClient / MockAgentClient
  → server/deepseek/chatProxy.ts
  → buildDeepSeekPayload()
  → DeepSeek stream
  → token events
  → parseGeneratedArtifact() after completion
  → artifactToMarkdown()
  → checkTokenUsage()
  → PreviewPanel tabs + validation badges
```

생성과 검증은 분리한다. streaming 중에는 사용자에게 즉시 토큰을 보여주고, 응답이
완성된 뒤 artifact 를 파싱해 preview 와 token usage check 를 갱신한다.

## Structured Output

LLM 응답은 자연어 문장과 함께 다음 delimiter 를 사용한다.

````md
<artifact type="component" filename="PrimaryButton.tsx">
```tsx
...
```
</artifact>

<artifact type="story" filename="PrimaryButton.stories.tsx">
```tsx
...
```
</artifact>

<artifact type="test" filename="PrimaryButton.test.tsx">
```tsx
...
```
</artifact>

<notes type="a11y">
...
</notes>

<notes type="token">
...
</notes>
````

이 포맷은 완전 JSON 출력을 강제하지 않으면서도 preview 와 validation 에 필요한
부분을 안정적으로 추출한다.

## 컴포넌트 구성

```txt
ChatScreen                  채팅 화면 최상위 합성
├─ ConversationView         메시지 thread
│  └─ MessageBubble         user/assistant 버블
│     ├─ AttachmentChip     참고 파일 칩
│     ├─ Markdown           어시스턴트 응답 렌더링
│     └─ MessageActions     복사 / 재생성 / 반응
├─ PreviewPanel             artifact workspace
│  └─ Component / Story / Test / Validation tabs
├─ EmptyState               첫 assistant bubble + 작업 템플릿
├─ ThemeToggle              라이트/다크 모드 전환
└─ PromptBar                mode selector + inline attach + textarea
```

## 경계 규칙

경계는 문서 권고가 아니라 `eslint.config.js` 의 `no-restricted-imports` 로 강제된다.

### Vapor 경계

`@vapor-ui/core` 직접 import 는 제품 컴포넌트 레이어와 `src/main.tsx` 에만 허용한다.
앱 레이어와 agent core 는 Vapor primitive 를 직접 알지 않는다.

### Agent 내부 경계

`src/app/**`, `src/components/chat/**` 는 `src/agent` 배럴만 import 한다.
`src/agent/MockAgentClient` 같은 내부 deep import 는 ESLint error 로 막는다.

## Token Usage Check

MVP 검증은 rule-based static check 다.

- raw hex, `rgb(...)`, `rgba(...)` 사용 감지
- hard-coded `px` spacing/radius 감지
- `--vapor-`, `@vapor-ui/core`, `colorPalette` 같은 Vapor token/primitives 사용 확인
- pass/warn/fail 로 정규화해 Validation tab 과 badge 에 반영

완전한 linter 가 아니라, DS 포트폴리오 MVP 에서 빠르게 피드백 가능한 안전장치로
설계했다.

## 스타일링

스타일은 Tailwind CSS v4 와 Vapor UI 의 Tailwind 프리셋을 함께 사용한다.

- Vapor 토큰은 `bg-v-canvas-100`, `gap-v-200` 같은 `v-` 유틸리티로 사용한다.
- 다크 모드는 Vapor `ThemeProvider` + `useTheme` 로 전환한다.
- primary color 는 강조색으로 제한하고, 검증 상태에는 semantic color 를 사용한다.
