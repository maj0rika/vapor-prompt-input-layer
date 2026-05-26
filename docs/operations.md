# Operations — Vapor UI Compliance Workbench

이 문서는 Vapor UI Compliance Workbench 를 실행·검증·면접 데모할 때 필요한 명령과 한계 사항을 정리한다. 코드 변경 없이 운영 관점에서 알아야 할 것만 담는다.

## 1. 한 줄 정체성

> 구름 Vapor Design System 적용 품질을 deterministic 하게 검사하는 로컬 감사 도구.

LLM/생성기/Chat 인상 없음. 첫 화면은 "검사 실행" 버튼 중심의 7-게이트 대시보드.

## 2. 빠른 실행

```bash
npm install
npm run dev               # http://localhost:5180
```

브라우저에서 첫 화면 → "검사 실행" 클릭 → `/api/compliance/report` 가 Vite dev 미들웨어를 통해 deterministic 결과를 반환 → UI 가 게이트 카드를 렌더.

## 3. 검증 매트릭스

| 명령 | 의미 | 기대 결과 |
|---|---|---|
| `npm run typecheck` | TypeScript 타입 검사 | PASS |
| `npm run lint` | ESLint (jsx-a11y + vapor + boundary rules) | PASS |
| `npm test` | Vitest 단위/컴포넌트 | 349 PASS |
| `npm run build` | TS + Vite 프로덕션 빌드 | exit 0 |
| `npm run test:e2e` | Playwright (compliance-page.spec) | 7 PASS |
| `npm run compliance:audit` | 전체 `src/` 감사 (legacy 포함) | JSON (FAIL 가능) |
| `npm run compliance:governed` | governed 범위만 (정책 강제 대상) | JSON |
| `npm run verify:compliance` | governed + `--fail-on-fail` (CI 게이트) | exit 0 |
| `npx tsx scripts/compliance-smoke.ts` | 4 viewport headless + 스크린샷 + result.json | exit 0 |

### 권장 CI 시퀀스

```bash
npm run typecheck \
  && npm run lint \
  && npm test \
  && npm run build \
  && (npm run dev -- --port 5180 --strictPort &) \
  && sleep 4 \
  && npx tsx scripts/compliance-smoke.ts \
  && npx playwright test tests/compliance-page.spec.ts \
  && npm run verify:compliance
```

`compliance-smoke` 가 먼저 돌아야 `test-results/compliance-smoke/result.json` 이 생기고, 그 결과를 `verify:compliance` 의 layout/responsive 게이트가 읽는다 (1시간 stale TTL).

## 4. 6 게이트와 데이터 원천

| 게이트 | 판정 데이터 | 입력 없음 시 |
|---|---|---|
| 레이아웃 품질 (`layout-overflow`) | `compliance-smoke` JSON `anyOverflow` | WARN (skip + 재실행 안내) |
| Vapor 컴포넌트 사용 (`vapor-components`) | governed 소스에서 native `<button>/<input>` 정규식 + `<IconButton>` aria-label | 항상 실행 |
| 토큰 & 스타일 (`design-tokens`) | governed 소스에서 raw hex/rgb/hsl/oklch + 하드코딩 spacing 정규식 | 항상 실행 |
| 접근성 (`accessibility`) | `npx eslint --format json` 의 `jsx-a11y/*` 메시지 | WARN (skip + 안내) |
| 반응형 & 테마 (`responsive-design`) | `compliance-smoke` JSON `testedBreakpoints` | WARN (skip + 안내) |
| 문서 준비도 (`documentation`) | README "Vapor UI Compliance Workbench" 텍스트 + `docs/vapor-compliance.md` 존재 | 항상 실행 |

Roadmap 7번째 게이트 (code-quality — typecheck/build/secret scan 통합) 는 후속 wire 대상.

## 5. Governed scope

검사 정책이 강제하는 경로:

```
src/components/compliance/**
src/app/CompliancePage.tsx
src/app/App.tsx
```

검사 엔진 자신 (`src/compliance/rules/`) 은 위반 패턴을 문자열로 참조하므로 scope 에서 제외 (self-reference 방지). 레거시 (`src/legacy/`, `server/legacy/`) 도 제외.

`?scope=all` 쿼리 파라미터 또는 `--governed` 플래그 부재 시 전체 `src/` 감사. 이때 legacy 코드의 raw color/spacing 다수 검출 → FAIL 가능.

## 6. 레거시 격리

LLM/DeepSeek/생성기 코드는 `src/legacy/` + `server/legacy/` 로 물리 격리. ESLint `no-restricted-imports` 가 신규 compliance 코드의 import 를 차단.

```
src/legacy/
├── agent/             # DeepSeek agent 엔진
├── app/{chat,demo}/   # 구 첫 화면
└── components/{chat,prompt}/

server/legacy/
├── deepseek/          # /api/deepseek/* 핸들러 (현재 미연결)
├── preview/           # 아티팩트 미리보기 (현재 미연결)
└── validation/        # 구 validation runner
```

Vite plugin 에서 이 경로들의 미들웨어는 unwire 됨 (`d755dbe`). 빌드/테스트는 계속 통과하지만 product 경로에서 실행되지 않음.

## 7. 면접 3분 데모 스크립트

| 시간 | 행동 | 말할 것 |
|---|---|---|
| 0:00 | `npm run dev` → 브라우저 | "Vapor UI Compliance Workbench 입니다. LLM 생성기가 아니라 Vapor DS 적용 품질을 deterministic 하게 검사합니다." |
| 0:30 | "검사 실행" 클릭 | "버튼 한 번으로 6개 게이트가 실제 데이터로 채점됩니다." |
| 1:00 | overall PASS 100점 보여주기 | "타임스탬프·점수·게이트별 status 가 한국어로 표시됩니다." |
| 1:30 | 토큰 게이트 카드 → 증거 탭 | "위반이 나오면 file:line 과 함께 수정 가이드를 제공합니다." |
| 2:00 | 사이드바에서 다른 게이트 전환 | "ESLint jsx-a11y, Playwright overflow, raw color 정규식 등 7 종 검사를 결합합니다." |
| 2:30 | 터미널 `npm run verify:compliance` | "CI 게이트는 동일 엔진으로 exit 1 도 가능합니다 (`--fail-on-fail`)." |
| 3:00 | 마무리 | "구름 Vapor 공식 문서 기준에 직접 연결됩니다 (`docs/vapor-compliance.md`)." |

## 8. 한계 (Not-tested / Known limitations)

- **Production 빌드 미들웨어**: `/api/compliance/report` 는 Vite dev/preview 서버 미들웨어. 정적 호스팅 환경에는 별도 Node 런타임 + 핸들러 필요. 현재는 dev/preview 한정.
- **Code Quality 게이트**: 7-게이트 로드맵 중 마지막 1 개는 후속 wire (typecheck + bundle 사이즈 + secret scan 통합 예정). 현 빌드는 6 게이트로 100점.
- **stale TTL**: `result.json` 1 시간 경과 시 layout/responsive 게이트는 WARN/skip fallback. CI 에서는 smoke 직후 verify 실행 필요.
- **Audit 모드 점수**: legacy 코드의 raw color/spacing 이 다수라 `scope=all` 점수는 낮게 나옴 (현재 ≈42). 정책 강제 대상 (governed) 에서만 PASS.
- **다크 테마 viewport**: smoke 는 현재 light 만. dark 토글 후 overflow/console 재측정은 별도 phase.
- **단일 도메인 검사**: 컴포넌트 라이브러리 한정 검사. API/State 관리/네트워크 패턴 검사는 범위 밖.
