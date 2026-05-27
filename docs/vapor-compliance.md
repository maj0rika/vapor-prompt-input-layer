# Vapor UI 컴플라이언스 게이트 기준

각 게이트가 검사하는 항목과 Vapor 공식 기준의 매핑입니다.

참조 문서:
- [Vapor Design Principles](https://vapor-ui.goorm.io/docs/getting-started/principles)
- [Tailwind CSS v4 연동](https://vapor-ui.goorm.io/docs/getting-started/tailwindcss-v4)
- [ESLint 설정](https://vapor-ui.goorm.io/docs/getting-started/eslint)

---

## Gate 1 — 레이아웃 (Layout Quality)

**목적:** 컴포넌트와 페이지가 Vapor 간격 체계에 맞게 배치되는지 확인합니다.

| 검사 항목 | 판정 기준 | 근거 |
|-----------|-----------|------|
| 뷰포트 오버플로 | 390 / 768 / 1280 / 1440px 에서 가로 스크롤 없음 | Vapor 반응형 레이아웃 지침 |
| 간격 일관성 | `gap-*` / `p-*` / `m-*` 값이 Vapor spacing scale 사용 | Tailwind CSS v4 연동 토큰 |
| 중단점별 계층 | 모바일 → 데스크탑 전환 시 레이아웃 깨짐 없음 | Vapor breakpoint 정의 |
| Z-index 충돌 | 모달 / 드롭다운 / 툴팁 레이어 순서 올바름 | Vapor layer 스택 기준 |

**PASS 조건:** 오버플로 0 · 간격 위반 0 · Z-index 충돌 0  
**WARN 조건:** spacing 토큰 미참조 ≤ 2  
**FAIL 조건:** 오버플로 1개 이상 또는 간격 위반 3개 이상

---

## Gate 2 — Vapor 컴포넌트 (Vapor Component Usage)

**목적:** Vapor primitive 컴포넌트를 올바르게 사용하는지 확인합니다.

| 검사 항목 | 판정 기준 | 근거 |
|-----------|-----------|------|
| Primitive 사용 | `Button` / `Text` / `Badge` / `Card` 등 Vapor 컴포넌트 직접 사용 | `@vapor-ui/core` API |
| 래핑 규칙 | Vapor primitive 를 직접 스타일 오버라이드 없이 사용 | Vapor 컴포넌트 합성 지침 |
| 금지 패턴 부재 | `eslint-plugin-vapor` 위반 0 | [ESLint 플러그인](https://vapor-ui.goorm.io/docs/getting-started/eslint) |
| import 경로 | `@vapor-ui/core` · `@vapor-ui/icons` 경로만 사용 | Vapor 패키지 구조 |

**PASS 조건:** ESLint vapor 위반 0 · 금지 패턴 0  
**WARN 조건:** Vapor primitive 대신 HTML element 직접 사용 1–2건  
**FAIL 조건:** ESLint vapor 오류 1개 이상

---

## Gate 3 — 토큰 & 스타일 (Token & Styling)

**목적:** Vapor CSS 토큰을 사용하고 raw 값을 직접 쓰지 않는지 확인합니다.

| 검사 항목 | 판정 기준 | 근거 |
|-----------|-----------|------|
| Raw 색상 미사용 | `#rrggbb` · `rgb(...)` · `hsl(...)` 0건 | Vapor color token 체계 |
| Raw 간격 미사용 | 하드코딩 `px` spacing 0건 | Vapor spacing scale |
| Raw 반경 미사용 | 하드코딩 `px` border-radius 0건 | Vapor radius token |
| Arbitrary Tailwind 값 | `w-[123px]` 류 arbitrary 값 0건 | Tailwind CSS v4 연동 기준 |
| Vapor 토큰 참조 | CSS 변수 `--vp-*` 또는 Vapor utility class 사용 ≥ 1 | Vapor token 네이밍 |

**PASS 조건:** raw color 0 · raw spacing 0 · raw radius 0  
**WARN 조건:** raw spacing ≤ 2 또는 raw radius ≤ 1  
**FAIL 조건:** raw color 1건 이상

---

## Gate 4 — 접근성 (Accessibility)

**목적:** 컴포넌트가 WCAG 2.1 AA 기준과 Vapor 접근성 지침을 충족하는지 확인합니다.

| 검사 항목 | 판정 기준 | 근거 |
|-----------|-----------|------|
| Axe violations | 0건 | WCAG 2.1 AA |
| 키보드 탐색 | Tab / Enter / Space / Escape 동선 완전 | Vapor keyboard 지침 |
| ARIA 레이블 | 모든 인터랙티브 요소에 접근 가능 이름 존재 | ARIA 1.2 |
| 색상 대비 | 텍스트 대비율 ≥ 4.5 : 1 (일반) / ≥ 3 : 1 (대형) | WCAG 1.4.3 |
| 포커스 표시 | 포커스 링 가시적 · 억제 없음 | WCAG 2.4.7 |
| 상태 공지 | 로딩 / 오류 / 성공 상태를 스크린리더가 인지 가능 | ARIA live region |

**PASS 조건:** axe violations 0 · 키보드 완전 동작  
**WARN 조건:** 포커스 표시 미흡 또는 aria-label 누락 1건  
**FAIL 조건:** axe violations 1건 이상 또는 키보드 트랩 발생

---

## Gate 5 — 반응형 & 테마 (Responsive & Theme)

**목적:** 다양한 뷰포트와 다크모드에서 Vapor 테마 토큰이 올바르게 적용되는지 확인합니다.

| 검사 항목 | 판정 기준 | 근거 |
|-----------|-----------|------|
| 반응형 뷰포트 | 390 / 768 / 1280 / 1440 / 1480px 모두 정상 렌더 | Vapor breakpoint 정의 |
| 다크모드 | `data-theme="dark"` 전환 후 Vapor 다크 토큰 적용 | Vapor 테마 시스템 |
| 테마 하드코딩 부재 | 색상이 테마 조건 없이 고정되어 있지 않음 | Vapor color 사용 지침 |
| 미디어쿼리 | `prefers-color-scheme` 시스템 설정 반영 | CSS Media Queries |
| Reduced motion | `prefers-reduced-motion` 존중 · 애니메이션 최소화 | WCAG 2.3.3 |

**PASS 조건:** 5개 뷰포트 오버플로 0 · 다크모드 토큰 누락 0  
**WARN 조건:** 특정 뷰포트에서 미세 레이아웃 틀어짐 1건  
**FAIL 조건:** 뷰포트 오버플로 1건 이상 또는 다크모드 하드코딩 색상 존재

---

## Gate 6 — 코드 품질 (Code Quality)

**목적:** TypeScript 타입 안전성과 ESLint 경계 규칙을 강제합니다.

| 검사 항목 | 판정 기준 | 근거 |
|-----------|-----------|------|
| TypeScript strict | `tsc --noEmit` 오류 0 | `tsconfig.app.json` strict 설정 |
| ESLint 오류 | `eslint .` 오류 0 | eslint.config.js |
| Import 경계 | 새 코드에서 레거시 LLM 모듈 import 금지 | ESLint boundary rule |
| 번들 예산 | 초기 JS gzip ≤ 220KB | `verify:bundle` |
| 미사용 코드 | 명시적으로 사용하지 않는 export 없음 | TypeScript no-unused |

**PASS 조건:** TS 오류 0 · ESLint 오류 0 · 번들 예산 통과  
**WARN 조건:** ESLint warning ≤ 3  
**FAIL 조건:** TS 오류 1건 이상 또는 ESLint 오류 1건 이상

---

## Gate 7 — 문서 준비도 (Documentation Readiness)

**목적:** 컴포넌트에 필요한 최소 문서가 갖춰져 있는지 확인합니다.

| 검사 항목 | 판정 기준 | 근거 |
|-----------|-----------|------|
| Props 명세 | 공개 props에 TypeScript 타입 + JSDoc 주석 존재 | 팀 컨벤션 |
| 스토리 파일 | `.stories.tsx` 파일 존재 · 기본 variant 포함 | Storybook 연동 기준 |
| 변경이력 | 주요 변경 시 관련 docs 업데이트 | docs/git-history.md |
| 접근성 주석 | 비자명 ARIA 패턴에 설명 주석 존재 | Vapor 접근성 지침 |

**PASS 조건:** props 명세 · 스토리 파일 모두 존재  
**WARN 조건:** JSDoc 주석 미흡 또는 스토리 variant 부족  
**FAIL 조건:** 스토리 파일 부재 또는 props 타입 미정의

---

## 종합 판정 기준

| 전체 결과 | 조건 |
|-----------|------|
| **PASS** | 7개 게이트 모두 PASS 또는 WARN |
| **WARN** | FAIL 0 · WARN 1개 이상 |
| **FAIL** | FAIL 1개 이상 |

검사 명령:

```bash
npm run verify:ci          # 정적 분석 + 빌드 + E2E 전체
npm run verify:compliance  # Vapor 7개 게이트 전용
```
