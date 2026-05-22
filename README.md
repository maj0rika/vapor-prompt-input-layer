# Vapor Prompt Input Layer

Vapor UI를 사용해 AI 챗 입력 영역을 재사용 가능한 **제품 컴포넌트 레이어**로
설계한 케이스 스터디입니다.

이 프로젝트는 Vapor 컴포넌트를 단순히 조립하는 데서 멈추지 않고, PromptBox ·
Dropzone · AttachmentList · DataSourceSelector 라는 제품 기준 컴포넌트로 감싸
앱 레이어의 사용 방식을 일관되게 제한합니다.

> 데모: 로컬에서 `npm run dev` 로 실행할 수 있습니다. (Vercel 배포 링크는
> 배포 후 추가)

## Engineering Focus

1. 화면 중심 UI를 재사용 가능한 컴포넌트 구조로 분해
2. Vapor primitive와 제품 컴포넌트 레이어의 책임 분리
3. 앱 레이어의 primitive 직접 사용을 ESLint 규칙으로 차단
4. 접근성 체크리스트와 테스트를 통한 회귀 방지
5. 의미 있는 작업 단위별 커밋 히스토리

## Case Study

### Problem

AI Prompt Input은 단순 textarea가 아니라 입력, 제출, 파일 첨부, 첨부 상태,
데이터소스 선택, 키보드 조작이 결합된 복합 UI입니다. 화면마다 따로
구현하면 동작과 스타일, 접근성 기준이 파편화됩니다.

### Approach

Vapor UI를 기반으로 PromptBox · Dropzone · AttachmentList ·
DataSourceSelector를 제품 컴포넌트로 정의하고, 앱은 이 레이어와 이를 조립한
PromptBar만 사용하도록 설계했습니다.

### Architecture

`@vapor-ui/core` → Product Component Layer → Demo App 구조로 책임을 나눴습니다.
앱 레이어에서는 `@vapor-ui/core` 직접 import를 금지하고, 제품 컴포넌트
레이어에서만 Vapor primitive를 사용하도록 ESLint `no-restricted-imports`로
강제했습니다.

### Validation

- **Vitest** — 컴포넌트 상태·이벤트·검증 로직 단위 테스트
- **Playwright** — 키보드 기반 사용자 흐름 E2E 테스트
- **ESLint** — `eslint-plugin-jsx-a11y`, `eslint-plugin-vapor` 접근성 규칙
- **TypeScript strict 모드**

### Result

Vapor primitive를 제품 요구사항에 맞게 래핑해, 재사용 가능한 AI Prompt Input
컴포넌트 레이어를 구성했습니다.

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

- [Architecture](docs/architecture.md) — 레이어 구조와 책임 분리
- [Component API](docs/component-api.md) — 공개 컴포넌트 props 명세
- [Vapor Mapping](docs/vapor-mapping.md) — Vapor primitive 매핑과 래핑 이유
- [Accessibility Checklist](docs/accessibility-checklist.md) — 접근성 점검 항목
- [Git History Notes](docs/git-history.md) — 작업 단위별 커밋 의도

## Project Structure

```
src/
├─ app/                  데모 앱 (Vapor 직접 import 금지)
│  └─ demo/
├─ components/prompt/     제품 컴포넌트 레이어
└─ lib/                   파일 검증·포맷 유틸
tests/                    Playwright E2E
docs/                     설계·API·접근성 문서
```
