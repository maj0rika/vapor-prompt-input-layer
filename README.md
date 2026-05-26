# Vapor UI Compliance Workbench

구름 Vapor Design System 적용 품질을 deterministic 하게 검사하는 로컬 감사 도구입니다.

## 목적

Vapor UI Compliance Workbench는 컴포넌트가 [Vapor Design System](https://vapor-ui.goorm.io/docs/getting-started/principles) 기준을 실제로 충족하는지 7개 게이트로 측정합니다. PASS / WARN / FAIL 판정은 규칙 엔진의 결정론적 검사 결과에서만 나오며, 임의 판단이나 추론에 의존하지 않습니다.

## 검사 게이트 (7개)

| # | 게이트 | 검사 내용 |
|---|--------|-----------|
| 1 | **레이아웃** | 뷰포트 오버플로 · 간격 일관성 · 중단점별 레이아웃 계층 |
| 2 | **Vapor 컴포넌트** | Vapor primitive 사용 여부 · 래핑 규칙 준수 · 금지 패턴 부재 |
| 3 | **토큰 & 스타일** | raw hex/rgb/px 미사용 · Vapor CSS 토큰 참조 · arbitrary Tailwind 값 부재 |
| 4 | **접근성** | axe violations 0 · 키보드 탐색 · ARIA 레이블 · 색상 대비 |
| 5 | **반응형 & 테마** | 390 / 768 / 1280 / 1440 뷰포트 · 다크모드 테마 토큰 적용 |
| 6 | **코드 품질** | TypeScript strict · ESLint ([vapor 플러그인](https://vapor-ui.goorm.io/docs/getting-started/eslint)) 경계 · 번들 예산 |
| 7 | **문서 준비도** | 컴포넌트 props 명세 · 스토리 파일 존재 · 변경이력 기록 |

## 실행

```bash
npm install
npm run dev        # 개발 서버 → 브라우저에서 검사 실행 버튼 클릭
npm run build      # 프로덕션 빌드
```

## 검증 명령

```bash
npm run typecheck          # TypeScript strict 검사
npm run lint               # ESLint (접근성 + Vapor 경계 규칙)
npm test                   # Vitest 단위 테스트
npm run build              # 빌드 성공 여부
npm run test:e2e           # Playwright E2E (smoke 제외)
npm run verify:ci          # 위 전체 + 번들 예산 + Lighthouse + compliance strict
npm run verify:compliance  # Vapor 7개 게이트 전용 검사 (Phase 3에서 추가)
```

`verify:ci` 는 아래 항목을 단일 명령으로 강제합니다.

| 게이트 그룹 | 명령 | 기준 |
|------------|------|------|
| 정적 분석 | `typecheck` · `lint` | 오류 0 |
| 단위 테스트 | `test` | 전체 통과 |
| 빌드 | `build` | 성공 |
| 번들 예산 | `verify:bundle` | 초기 JS gzip ≤ 220KB |
| 성능 / 접근성 | `verify:lighthouse` | Perf ≥ 90 · A11y ≥ 95 · LCP ≤ 2.5s · CLS ≤ 0.1 |
| E2E | `test:e2e` | Playwright 전체 통과 |

## 한계

- **로컬 감사 도구입니다.** 저장소 변경이나 PR 생성 기능은 없습니다.
- **GitHub Actions 연동은 미구현입니다.** 로컬 최종 품질 게이트는 `npm run verify:ci`입니다.
- **Vapor 토큰 검사 범위:** color · spacing · radius 세 축만 검사합니다. 그 외 토큰 카테고리는 unknown으로 보고됩니다.
- **브라우저 실행 필요:** Lighthouse 및 viewport 검사는 headless Chromium이 필요합니다.
- **레거시 생성물 검증 (`legacy:verify:generated`):** LLM artifact pipeline 검증으로, 제품 final gate가 아닙니다. 레거시 디버깅 시에만 사용하세요.
- **server/compliance/:** `tsx` 런타임으로 실행됩니다 (npm scripts의 tsx runner). `tsc` typecheck 대상이 아니며, `verify:compliance`가 런타임 컴파일을 보장합니다.

## 데모 스크립트 (3분)

면접 데모용 시나리오. 모두 결정론적 경로라 외부 서비스 연결 없이 실행됩니다.

1. `npm run dev` 실행 → 브라우저 열기
2. **검사 실행** 버튼 클릭 → 7개 게이트 카드 렌더링 확인
3. 게이트별 PASS / WARN / FAIL 뱃지와 근거(evidence) 확인
4. FAIL 게이트 → **수정 가이드** 패널 열기 → 조치 항목 확인
5. `npm run verify:ci` 터미널 실행 → 전체 게이트 통과 확인

## 기술 스택

React · TypeScript · Vite · [Vapor UI](https://vapor-ui.goorm.io/docs/getting-started/principles) · [Tailwind CSS v4](https://vapor-ui.goorm.io/docs/getting-started/tailwindcss-v4) · Vitest · Playwright · eslint-plugin-vapor

## 프로젝트 구조

```txt
src/
├─ compliance/           게이트 엔진 (types · report · rules)
├─ app/                  CompliancePage 진입점
└─ components/
   └─ vapor/             Vapor primitive 래퍼
server/
└─ compliance/           서버 측 검사 엔드포인트
tests/                   Playwright E2E
docs/                    설계 · 게이트 기준 · 접근성 문서
```

## 문서

- [Vapor 컴플라이언스 게이트 기준](docs/vapor-compliance.md) — 게이트별 Vapor 기준 매핑
- [Architecture](docs/architecture.md) — 레이어 구조와 흐름
- [Operations & Deployment Boundaries](docs/operations.md) — 로컬 도구 범위와 제약
- [Component API](docs/component-api.md) — 공개 컴포넌트 props 명세
- [Vapor Mapping](docs/vapor-mapping.md) — Vapor primitive 매핑과 래핑 이유
- [Accessibility Checklist](docs/accessibility-checklist.md) — 접근성 점검 항목
- [Quality Gates](docs/quality-gates.md) — 통과 기준과 명령
- [Validation Matrix](docs/validation-matrix.md) — 현재 구현/미구현 검증 매트릭스
