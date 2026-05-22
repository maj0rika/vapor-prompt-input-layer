# Git History Notes

이 프로젝트는 한 번에 만든 뒤 한 번에 커밋하지 않았다. 작업을 의미 있는
단위로 나누고, **설계 → 구현 → 검증 → 문서화** 흐름이 히스토리에서
드러나도록 커밋했다.

## 작업 흐름

### 1. 프로젝트 초기화

- `chore: scaffold vite react project`
- `chore: install vapor ui and tailwind dependencies`
- `docs: add project architecture plan`

Vite + React + TypeScript 기반을 세우고, Vapor UI 와 Tailwind CSS v4 를
연결한 뒤, 컴포넌트 레이어 구조를 문서로 먼저 정의했다.

### 2. 타입과 경계 설정

- `feat: define prompt input component types`
- `chore: restrict primitive imports in app layer`

컴포넌트를 구현하기 전에 공개 타입을 먼저 정의하고, 앱 레이어의 Vapor
직접 import 를 ESLint 규칙으로 차단했다. 경계를 코드보다 먼저 세웠다.

### 3. 컴포넌트별 구현 + 검증

각 컴포넌트는 구현 커밋과 테스트 커밋을 분리했다.

- PromptBox: 구현 → 동작 테스트
- Dropzone: 구현 → 파일 검증 로직 → 검증 테스트
- AttachmentList: 구현 → 상태 테스트
- DataSourceSelector: 구현 → 선택 테스트

기능 커밋과 테스트 커밋을 나눠, 무엇을 만들고 무엇을 검증했는지
히스토리에서 구분되게 했다.

### 4. 조립과 정리

- `feat: compose prompt bar demo`
- `style: polish prompt input layout`

개별 컴포넌트를 PromptBar 로 조립하고, 레이아웃을 별도 커밋으로 정리했다.

### 5. 접근성·E2E 검증

- `chore: add accessibility lint rules and enable strict typescript`
- `test: add prompt input e2e flow`
- `test: add keyboard interaction coverage`

접근성 lint 와 TypeScript strict 모드를 활성화하고, Playwright 로 실제
사용자 흐름과 키보드 조작을 검증했다.

### 6. 문서화

- `docs: document component api`
- `docs: add vapor primitive mapping`
- `docs: add accessibility checklist`
- `docs: add git history notes`

주요 설계가 끝난 뒤 문서를 별도 커밋으로 남겼다.

## 커밋 규칙

- 작업 단위가 끝날 때마다 커밋하고, 해당 단계에 맞는 검증
  (`lint` / `typecheck` / `test` / `build`)을 수행했다.
- 여러 기능을 한 커밋에 몰아넣지 않았다.
- 마지막에 전체를 squash 하지 않고 실제 작업 흐름을 그대로 남겼다.
- 커밋 메시지는 `<type>: <summary>` 형식(`feat` / `test` / `docs` /
  `chore` / `style` / `fix` / `refactor`)으로 작성했다.
