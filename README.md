# Vapor Agent Chat — Component Layer Case Study

Vapor UI 로 AI 에이전트 채팅 화면(글쓰기 코치)을 구현하면서, **레이어 간
import 경계를 ESLint 로 강제**한 케이스 스터디입니다.

핵심은 화면이 아니라 구조입니다. Vapor primitive 를 제품 컴포넌트 레이어로
감싸고, React 와 분리된 순수 에이전트 엔진을 두며, 앱·UI·엔진 레이어 사이의
의존 방향을 lint 규칙으로 고정했습니다.

> 데모: 로컬에서 `npm run dev` 로 실행할 수 있습니다. (Vercel 배포 링크는
> 저장소 연결 후 추가)

## Engineering Focus

1. **경계의 강제** — 레이어 간 import 규칙을 문서가 아니라 ESLint
   `no-restricted-imports` 로 강제하고, negative test 로 규칙이 실제 동작함을 확인
2. **React 와 분리된 엔진** — 모의 스트리밍을 교체 가능한 `AgentClient`
   인터페이스 + `AsyncIterable` 제너레이터 + 순수 상태머신으로 설계
3. **명시적 teardown 계약** — 언마운트 중 스트리밍을 abort 하고 누수를 막음
4. 접근성 lint·체크리스트와 단위/E2E 테스트를 통한 회귀 방지
5. 의미 있는 작업 단위별 커밋 히스토리

## Case Study

### Problem

AI 에이전트 채팅 화면은 대화 thread, 토큰 스트리밍, 파일 첨부, 데이터소스
선택, 초안 미리보기, 메시지 액션이 결합된 복합 UI 입니다. 화면 단위로
구현하면 디자인시스템 사용 방식과 비동기 처리, 접근성 기준이 파편화됩니다.

### Approach

UI 를 세 레이어로 나눴습니다.

- **Agent Engine** (`src/agent/**`) — 모의 스트리밍·상태머신. React 무관 순수 로직.
- **Product Component Layer** (`src/components/**`) — Vapor primitive 를 감싼
  제품 컴포넌트(PromptBar, ChatScreen 등).
- **Demo App** (`src/app/**`) — 제품 컴포넌트만 조립.

### Boundary

두 가지 경계를 ESLint 로 강제합니다.

1. **Vapor 경계** — `@vapor-ui/core` 직접 import 는 제품 컴포넌트 레이어에서만
   허용. 허용 소비처를 명시적으로 열거한다.
2. **agent-internal 경계** — 엔진은 배럴로만 노출. 내부 모듈 deep import 는
   ESLint error.

규칙이 실제로 위반을 잡아내는지는 negative probe 로 검증했습니다.

### Validation

- **Vitest** — 엔진(토큰 순서·취소·상태머신)과 컴포넌트 단위 테스트.
  `useAgentStream` 의 언마운트 teardown 도 검증.
- **Playwright** — 대화 흐름, 스트리밍 취소, 미리보기 토글, 메시지 액션,
  키보드 조작 E2E.
- **ESLint** — `eslint-plugin-jsx-a11y`, `eslint-plugin-vapor` 접근성 규칙 +
  경계 규칙.
- **TypeScript strict 모드**.

### Result

Vapor primitive 를 제품 요구사항에 맞게 래핑한 AI 에이전트 채팅 화면을,
레이어 경계가 강제되고 엔진이 단독 테스트되는 구조로 구성했습니다.

## Tech Stack

React · TypeScript · Vite · Vapor UI · Tailwind CSS v4 · Vitest · Playwright

## Getting Started

```bash
npm install
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run lint       # ESLint (접근성 + 경계 규칙)
npm run test       # Vitest 단위 테스트
npm run test:e2e   # Playwright E2E 테스트
```

## Documentation

- [Architecture](docs/architecture.md) — 레이어 구조와 2종 경계 규칙
- [Component API](docs/component-api.md) — 공개 컴포넌트 props 명세
- [Vapor Mapping](docs/vapor-mapping.md) — Vapor primitive 매핑과 래핑 이유
- [Accessibility Checklist](docs/accessibility-checklist.md) — 접근성 점검 항목
- [Git History Notes](docs/git-history.md) — 작업 단위별 커밋 의도

## Project Structure

```
src/
├─ agent/                모의 에이전트 엔진 (React 무관 순수 로직)
├─ app/                  데모 앱 (Vapor·agent 내부 직접 import 금지)
│  └─ chat/
├─ components/
│  ├─ chat/              채팅 제품 컴포넌트 레이어
│  └─ prompt/            입력 제품 컴포넌트 레이어
└─ lib/                  파일 검증·포맷 유틸
tests/                   Playwright E2E
docs/                    설계·API·접근성 문서
```
