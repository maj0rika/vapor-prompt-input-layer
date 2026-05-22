# Vapor DS Automation Agent

Vapor Design System 기반 컴포넌트 생성, Storybook 스토리 작성, Vitest 테스트,
접근성 검증을 자연어 에이전트로 자동화하는 포트폴리오 케이스 스터디입니다.

목표는 단순 채팅 UI 가 아니라 DS 엔지니어의 반복 작업을 줄이고 산출물 품질을
높이는 자동화 워크플로우입니다. 사용자는 컴포넌트 요구사항과 참고 파일을
입력하고, 에이전트는 Vapor 기준에 맞는 artifact 를 생성해 우측 workspace 에
분리해 보여줍니다.

> 데모: 로컬에서 `npm run dev` 로 실행할 수 있습니다. DeepSeek 연결은
> `.env.local` 의 `DEEPSEEK_API_KEY` 를 서버 프록시에서만 읽습니다.

## Engineering Focus

1. **Vapor 업무 맥락** — Component, Token Sync, A11y Audit, Story/Test 모드로
   DS 자동화 intent 를 명확히 라우팅
2. **구조화된 artifact 출력** — LLM 응답을 delimiter 기반 component/story/test
   artifact 로 파싱하고 preview tab 으로 분리
3. **검증 피드백** — Typecheck, Unit, Axe, Vapor token usage 상태를 badge 와
   Validation tab 에 노출
4. **첨부 기반 컨텍스트** — Figma Variables JSON, token JSON, TS/TSX, MD/TXT 를
   composer 내부에서 첨부하고 텍스트로 추출
5. **경계의 강제** — Vapor primitive 사용 경계와 agent 내부 import 경계를 ESLint
   규칙으로 고정

## Case Study

### Problem

디자인 시스템 컴포넌트 작업은 컴포넌트 구현, 스토리 작성, 테스트, 접근성 검증,
토큰 준수 확인이 반복됩니다. 대화형 AI 를 붙이기만 하면 산출물이 thread 안에
흩어지고, 실제 DS 검토 흐름과 분리됩니다.

### Approach

화면을 좌측 conversation 과 우측 artifact workspace 로 나눴습니다. 대화는 요구사항
정리와 실행 로그를 담당하고, 생성된 코드는 Component / Story / Test / Validation
탭에서 검토합니다.

LLM 호출과 검증 로직은 `vite.config.ts` 에 두지 않고 모듈로 분리했습니다.

- `src/agent/promptBuilder.ts` — DS automation persona 와 요청 payload 구성
- `src/agent/responseParser.ts` — delimiter 기반 artifact 파싱
- `src/agent/tokenUsage.ts` — raw color/spacing/radius 탐지 기반 token check
- `server/deepseek/chatProxy.ts` — Vite dev/preview 서버의 얇은 API proxy

### Attachment Policy

- 허용: `.json`, `.ts`, `.tsx`, `.md`, `.txt`
- 기본 파일당 최대 크기: 300KB
- 기본 최대 파일 수: 5개
- 긴 텍스트는 잘라서 `truncated` 로 표시
- 첨부 내용은 신뢰하지 않는 참고 자료로 취급하며 system prompt 우선순위를 넘지 못함

### Validation Model

현재 MVP 는 생성 완료 후 artifact 를 파싱하고 rule-based static check 를 실행합니다.
Vapor token usage 는 raw hex, `rgb(...)`, hard-coded `px` spacing/radius, arbitrary
style 사용을 탐지해 pass/warn/fail 로 판정합니다. Typecheck, Unit, Axe 는 preview
상태 모델과 mock 안정성을 먼저 갖춘 뒤 실제 temp workspace runner 로 확장 가능한
구조입니다.

## Tech Stack

React · TypeScript · Vite · Vapor UI · Tailwind CSS v4 · react-markdown ·
Vitest · Playwright · DeepSeek Chat Completions compatible API

## Getting Started

```bash
npm install
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run lint       # ESLint (접근성 + 경계 규칙)
npm run test       # Vitest 단위 테스트
npm run test:e2e   # Playwright E2E 테스트
```

실제 DeepSeek 연결:

```bash
DEEPSEEK_API_KEY=... # .env.local 에 저장
npm run dev -- --host 127.0.0.1
```

## Documentation

- [Architecture](docs/architecture.md) — 레이어 구조, DeepSeek proxy, artifact flow
- [Component API](docs/component-api.md) — 공개 컴포넌트 props 명세
- [Vapor Mapping](docs/vapor-mapping.md) — Vapor primitive 매핑과 래핑 이유
- [Accessibility Checklist](docs/accessibility-checklist.md) — 접근성 점검 항목
- [Git History Notes](docs/git-history.md) — 작업 단위별 커밋 의도

## Project Structure

```txt
server/
└─ deepseek/             서버 전용 DeepSeek proxy
src/
├─ agent/                AgentClient, prompt builder, parser, token checker
├─ app/                  데모 앱 (Vapor·agent 내부 직접 import 금지)
│  └─ chat/
├─ components/
│  ├─ chat/              conversation + artifact workspace
│  └─ prompt/            mode selector + inline attachment composer
└─ lib/                  파일 검증·포맷 유틸
tests/                   Playwright E2E
docs/                    설계·API·접근성 문서
```
