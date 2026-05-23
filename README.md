# Vapor DS Automation Workbench

Vapor Design System 기반 컴포넌트 생성, Storybook 스토리 작성, Vitest 테스트,
접근성 검증을 자연어 에이전트로 자동화하는 포트폴리오 케이스 스터디입니다.

목표는 단순 채팅 UI 가 아니라 DS 엔지니어의 반복 작업을 줄이고 산출물 품질을
높이는 자동화 워크플로우입니다. 사용자는 컴포넌트 요구사항과 참고 파일을
입력하고, 에이전트는 Vapor 기준에 맞는 artifact 를 생성해 workspace 에 분리해
보여줍니다. 현재 코드는 parser, validation runner, artifact tabs 까지 검증됐고,
생성 컴포넌트는 Canvas 탭의 sandboxed iframe 에 렌더링되며, 기본/비활성 variant 와
light/dark theme 를 전환할 수 있습니다. 현재 Canvas 는 parsed artifact/story
metadata 기반 preview 이며, 임의 TSX를 직접 컴파일하는 runtime 은 후속 강화 대상입니다.

> 데모: 로컬에서 `npm run dev` 로 실행할 수 있습니다. DeepSeek 연결은
> `.env.local` 의 `DEEPSEEK_API_KEY` 를 서버 프록시에서만 읽습니다.

## Engineering Focus

1. **Vapor 업무 맥락** — Component, Token Sync, A11y Audit, Story/Test 모드로
   DS 자동화 intent 를 명확히 라우팅
2. **구조화된 artifact 출력** — LLM 응답을 delimiter 기반 component/story/test
   artifact 로 파싱하고 preview tab 으로 분리
3. **검증 피드백** — Typecheck, Unit, Axe, Vapor token usage runner 결과를
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
style 사용을 탐지해 pass/warn/fail 로 판정합니다. Live DeepSeek 응답에서
artifact 가 추출되면 `/api/deepseek/validate`가 실제 temp workspace runner 를
호출하고, Typecheck, Unit, Axe, Vapor token 결과로 preview validation 상태를
교체합니다.

최종 Workbench 기준은 더 엄격합니다. 생성물이 실제 temp workspace 에 파일로
써지고, TypeScript, Vitest, Axe, Vapor token gate 를 통과하는 것뿐 아니라,
사용자가 Canvas 에 mount 된 컴포넌트와 실패/수정 루프를 화면에서 확인할 수 있어야
합니다. 현재 증거 수준은 [Reality Check](docs/reality-check.md)와
[Validation Matrix](docs/validation-matrix.md)에 명시합니다.

## Tech Stack

React · TypeScript · Vite · Vapor UI · Tailwind CSS v4 · Vitest · Playwright ·
jest-axe · DeepSeek Chat Completions compatible API

## Getting Started

```bash
npm install
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run lint       # ESLint (접근성 + 경계 규칙)
npm run test       # Vitest 단위 테스트
npm run test:e2e   # Playwright E2E 테스트
npm run verify     # 기본 static/app quality gate
```

`npm run verify:generated` 는 fixture artifact 를 실제 temp workspace 에 쓰고,
TypeScript, Vitest, runtime Axe, Vapor token gate, cleanup 을 실행합니다.
`npm run verify:ci` 는 앱 품질 게이트, generated artifact gate, Lighthouse
budget 을 모두 실행합니다.

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
- [Quality Gates](docs/quality-gates.md) — 최종 통과 기준과 명령
- [Reality Check](docs/reality-check.md) — CLI 검증과 사용자 검증의 차이
- [Validation Matrix](docs/validation-matrix.md) — 현재 구현/미구현 검증 매트릭스
- [Git History Notes](docs/git-history.md) — 작업 단위별 커밋 의도

## Project Structure

```txt
server/
├─ deepseek/             서버 전용 DeepSeek proxy
└─ validation/           generated artifact validation endpoint + runner
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
