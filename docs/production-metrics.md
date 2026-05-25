# Production Metrics — 실무 활용 절대 지표

> 이 문서는 Vapor Design System 자동화 워크벤치가 "실무 검증 도구"로
> 사용 가능한지를 판정하는 **절대 측정 지표** 를 정의한다. 모든 항목은
> 명시된 명령으로 자동 측정 가능하며, 임계값을 충족하지 않으면 PR/배포
> 가 통과되지 않는다.

베이스라인 측정일: 2026-05-26 (main @ 379a6f9)
최근 갱신: 2026-05-26 (G017–G032 hardening 적용 후, **39/0/3 → 39 PASS / 0 FAIL / 3 TODO**)

## 1. 평가 축

| 축 | 의미 | 게이트 종류 |
|-----|------|------------|
| Security | LLM 출력이 호스트/네트워크를 위협하지 않음 | hard gate |
| Correctness | 생성물이 실제 컴파일/실행/검증을 통과 | hard gate |
| Trust Boundary | preview/validation/API key 격리 무결성 | hard gate |
| UX Coherence | 사용자가 막힘 없이 generate → validate → approve 완주 | hard gate |
| Vapor DS Conformance | 생성물과 도구 자체가 Vapor 토큰 규칙 준수 | hard gate |
| Operational Robustness | 동시성/누수/타임아웃 등 운영 부담을 단독 | hard gate |
| Performance | 응답 시간과 번들 예산 | hard gate |
| Accessibility | 키보드/스크린리더/대비 보장 | hard gate |

## 2. 절대 통과 지표 (각각 PASS/FAIL 단일 판정)

### Security

| ID | 지표 | 측정 명령 | 임계값 | 현재 |
|----|------|-----------|--------|------|
| S01 | LLM 파일명 path traversal 차단 | `grep -n isSafeArtifactFilename src/agent/responseParser.ts server/validation/writeGeneratedFiles.ts` + `npm test -- responseParser writeGeneratedFiles` | sanitize 함수 export + 양쪽에서 호출 + 거부 테스트 PASS | PASS (G018) |
| S02 | preview iframe 트러스트 경계 | `grep -nE 'sandbox=' src/components/chat/PreviewPanel.tsx` 및 origin separation 확인 | preview iframe 이 parent 와 다른 origin (127.0.0.1 vs localhost) 으로 load + `event.origin === previewOrigin` 검증 | PASS (도구 자체는 cross-origin 격리; iframe sandbox `allow-same-origin` 은 iframe 자체 origin 만 허용하며 parent storage 접근은 SOP 로 차단) |
| S03 | API key 클라이언트 노출 차단 | `grep -rn 'DEEPSEEK_API_KEY' src/` (test 제외) | 0건 | PASS |
| S04 | postMessage origin allowlist | `grep -n 'event.origin' src/components/chat/PreviewPanel.tsx` | `previewOrigin` 비교 분기 존재 | PASS |
| S05 | attachments untrusted 처리 | `npm test -- promptBuilder.attachments` | attachment text가 system prompt 우선순위 초과 못함 PASS | PASS |

### Correctness

| ID | 지표 | 측정 명령 | 임계값 | 현재 |
|----|------|-----------|--------|------|
| C01 | TypeScript strict | `npm run typecheck` | exit 0 | PASS |
| C02 | ESLint (경계 + a11y) | `npm run lint` | exit 0 | PASS |
| C03 | Unit/integration | `npm test` | 100% pass (현재 189/189) | PASS |
| C04 | Production build | `npm run build` | exit 0 | PASS |
| C05 | Generated artifact end-to-end | `npm run verify:generated` | 6/6 gates pass | PASS |
| C06 | E2E (smoke 제외) | `npm run test:e2e` | 100% pass | PASS |
| C07 | Bundle budget | `npm run verify:bundle` | initial gzip <= 200KB | PASS (199.63KB) |
| C08 | Lighthouse budget | `npm run verify:lighthouse` | Perf>=90 a11y>=95 BP>=95 SEO>=90 LCP<=2.5s CLS<=0.1 | PASS (Perf=100/A11y=100/BP=100/SEO=91, LCP=484ms, CLS=0) |

### Trust Boundary

| ID | 지표 | 측정 명령 | 임계값 | 현재 |
|----|------|-----------|--------|------|
| T01 | preview iframe 격리 | S02 + isolated loopback origin 분기 존재 | `createIsolatedPreviewOrigin` 호출 1건 이상 | PASS (S02 PASS) |
| T02 | 동시 validation 격리 | `grep -nE 'activeRuns?\\\|maxConcurrentRuns\\\|429' server/validation/validationProxy.ts` | 카운터 + 초과 시 429 응답 | PASS (G021) |
| T03 | temp workspace 누수 차단 | `npm test -- createTempWorkspace` 가 TTL sweep 동작을 검증 + `createTempWorkspace` 호출 시 자동 sweep | sweep 함수 export + happy/crash path 모두 cleanup 보장 | PASS (G028; lazy TTL sweep, default 60분) |
| T04 | 자식 프로세스 강제 종료 | `grep -n 'SIGKILL' server/validation/runCommand.ts` | SIGTERM 이후 escalation 존재 | PASS (G020) |

### UX Coherence

| ID | 지표 | 측정 명령 | 임계값 | 현재 |
|----|------|-----------|--------|------|
| U01 | 영문/한국어 혼용 레이블 | `grep -n "validation: '검증'" src/components/chat/PreviewPanel.tsx` | validation 탭 레이블이 '검증' | PASS (G022) |
| U02 | 키보드 only 완주 | Playwright `tests/keyboard-flow.spec.ts` (기존 E2E suite) | generate → validate → approve 100% 통과 | PASS (기존 E2E 51/51) |
| U03 | 실패 복구 경로 가시 | `grep -n 'onRepairGate' src/components/chat/PreviewPanel.tsx` | `onRepairGate` 콜백 함수가 ValidationPanel에 전달 | PASS |
| U04 | 응답 인내심 신호 | `grep -nE 'aria-busy\\\|role=\"status\"\\\|aria-live' src/components/chat/` | 적어도 1건 | PASS (aria-live, role="log" 다수) |
| U05 | 승인 의미 명시 | `grep -n 'PR.*생성.*않' src/components/chat/PreviewPanel.tsx` | "파일/PR 생성 없음" 안내 1건 이상 | PASS |
| U06 | 반복 수정 가드 | `grep -nE 'repairChainAttempts\\\|MAX_REPAIR_ATTEMPTS_PER_CHAIN' src/components/chat/ChatScreen.tsx` | UI 상 카운터 + 한도 초과 시 disabled | PASS (G023) |
| U07 | 다크모드 UI 적용 | E2E `tests/dark-mode.spec.ts` 가 ThemeToggle 클릭 시 `data-vapor-theme` 토글 + body 배경 luminance 변화 확인 | data-vapor-theme 가 토글되고 body 배경색이 실제로 변경됨 | PASS (G027; Vapor ThemeProvider 가 documentElement 에 `data-vapor-theme` 박아 토큰 CSS 변수 자동 전환) |

### Vapor DS Conformance

| ID | 지표 | 측정 명령 | 임계값 | 현재 |
|----|------|-----------|--------|------|
| V01 | 도구 자체의 raw hex | `grep -rEn '#[0-9a-fA-F]{3,6}\\b' src/components/ --include='*.tsx' \| grep -v '.test.'` | 0건 (실제 시각 출력 기준) | PASS (G025; canvasHtml 제거) |
| V02 | 도구 자체의 raw px in inline style | `grep -rEn 'style=.*\\d+px' src/components/` | 0건 | PASS |
| V03 | 도구 자체의 Tailwind gap-N(v-* 비사용) | `npm run verify:metrics` 의 V03 항목 또는 `grep -rEn '\\b(gap\\|p\\|m\\|mt\\|mb\\|...)-[0-9]\\b' src/components/` (width/border/outline 제외) | 0건 | PASS (G032; raw Tailwind spacing 클래스 전부 Vapor v-*로 변환, leading-zero `v-0XX` 형태도 정리) |
| V04 | 생성물 token gate (raw color) | `npm run verify:generated` 결과 token detail | rawColorCount 0 | PASS (fixture) |
| V05 | 생성물 token gate (hsl/oklch/named) | `npm test -- tokenUsage` | hsl/oklch/named color 감지, false negative 0 | PASS (G019) |
| V06 | ESLint 경계 위반 | `npm run lint` | 0건 (Vapor/agent boundary 강제) | PASS |

### Operational Robustness

| ID | 지표 | 측정 명령 | 임계값 | 현재 |
|----|------|-----------|--------|------|
| O01 | 동시 validation 한도 | T02 동일 | semaphore 활성 | PASS (G021) |
| O02 | timeout 시 자식 프로세스 강제 종료 | T04 동일 | SIGKILL escalation | PASS (G020) |
| O03 | 스트리밍 abort 안전성 | `npm test -- DeepSeekAgentClient abort` | abort 시 done/error/누수 0 | PASS |
| O04 | temp workspace cleanup 보장 | `npm run verify:generated` Cleanup gate | PASS | PASS |
| O05 | 운영 경계 문서화 | `docs/operations.md` 존재 + G016 키워드 | static hosting vs server tier 차이 + temp workspace 정책 명시 | PASS |

### Performance

| ID | 지표 | 측정 명령 | 임계값 | 현재 |
|----|------|-----------|--------|------|
| P01 | first token | live smoke timing | <= 3s | (수동 smoke) |
| P02 | artifact parse | `npm test -- responseParser.perf` (필요시 추가) | <= 100ms | (필요시) |
| P03 | temp workspace validation | `verify:generated` 총 duration | <= 15s | PASS (~5s fixture) |
| P04 | validation 30s hard timeout | `runCommand.ts` 코드 + 테스트 | 적용 + 테스트 PASS | (확인 필요) |
| P05 | Initial JS gzip | C07 동일 | <= 200KB | PASS (199.63KB) |

### Accessibility

| ID | 지표 | 측정 명령 | 임계값 | 현재 |
|----|------|-----------|--------|------|
| A01 | 생성물 axe violations | `verify:generated` Axe gate | 0 | PASS |
| A02 | 도구 자체 a11y | `npm run verify:lighthouse` | Lighthouse a11y >= 95 | PASS (100) |
| A03 | iframe title | `grep -n 'title=' src/components/chat/PreviewPanel.tsx \| grep iframe` | 1건 이상 | PASS ("Generated artifact canvas") |
| A04 | tab/tabpanel ARIA 페어 | `grep -nE 'role=\"tablist\\\|tab\\\|tabpanel\"' src/components/chat/PreviewPanel.tsx` + aria-labelledby/aria-controls 페어 | tab, tabpanel 모두 존재 + id/aria-labelledby/aria-controls 연결 | PASS (G026) |
| A05 | reduced motion 대응 | `grep -rn 'prefers-reduced-motion' src/` | 1건 이상 | PASS (G024) |

## 3. 게이트 매트릭스 (현재 상태, G017–G027 적용 후)

```
PASS  : C01 C02 C03 C04 C05 C06 C07 C08
        S01 S02 S03 S04 S05
        T01 T02 T03 T04
        U01 U02 U03 U04 U05 U06 U07
        V01 V02 V03 V04 V05 V06
        O01 O02 O03 O04 O05
        P03 P05
        A01 A02 A03 A04 A05
FAIL  : (없음)
TODO  : P01 P02 P04 (성능 마이크로벤치 — first token / parse / runner timeout;
        production-grade SLA 가 정해진 뒤 별도 measurement 가능)
```

총 PASS: 39 / FAIL: 0 / 측정 보류: 3

## 4. FAIL → PASS 전환 이력 (G017–G027)

각 FAIL 항목이 어떻게 해소되었는지 commit 단위로 기록한다.

- **S01 (path traversal)** — `isSafeArtifactFilename` 화이트리스트 (단일
  basename + `.ts`/`.tsx` + 64자 제한 + 제어 문자 거부) 가 parser 와
  writeGeneratedFiles 양쪽에서 강제 (G018, 13 개 신규 테스트).
- **S02 (iframe 트러스트 경계)** — 추가 분석 결과 iframe 은 `127.0.0.1`
  (localhost ↔ 변환) 으로 cross-origin 격리되어 있음. parent storage 접근은
  SOP 가 차단. `allow-same-origin` 은 iframe 자체 origin 만 허용.
- **T02/O01 (동시 validation)** — `maxConcurrentRuns` semaphore + HTTP 429 +
  `Retry-After: 5` (G021). E2E 는 `VAPOR_VALIDATION_MAX_CONCURRENT=20` 으로
  test cap 분리.
- **T04/O02 (SIGKILL escalation)** — SIGTERM 발송 후 `SIGKILL_ESCALATION_DELAY_MS=2_000`
  로 강제 종료 (G020).
- **U01 (Tests 레이블)** — `validation: '검증'` 으로 변경, E2E 14곳 selector
  동기화 (G022).
- **U06 (repair 무한 클릭)** — `MAX_REPAIR_ATTEMPTS_PER_CHAIN=3` chain 별
  counter + reset 지점 4개 + UI disabled + 카운터 노출 (G023).
- **U07 (다크모드)** — Vapor `ThemeProvider` 가 `documentElement` 에
  `data-vapor-theme` 박는 것이 unit + E2E 양쪽으로 확인. 별도 `dark:`
  Tailwind 클래스 없이도 Vapor 토큰 CSS 변수가 light/dark 값으로 자동 전환
  (G027 + tests/dark-mode.spec.ts 실측).
- **V01 (raw hex 14건)** — `canvasHtml` 함수 자체 제거; Canvas 탭 copy
  텍스트는 plain state summary 로 변경 (G025).
- **V05 (hsl/oklch/named 미탐지)** — Regex 확장 + 명명 색상 키워드 set +
  arbitrary Tailwind 감지 (G019, 11 개 신규 테스트).
- **A04 (tabpanel)** — id / aria-labelledby / aria-controls / tabIndex
  연결 (G026).
- **A05 (reduced motion)** — `prefersReducedMotion()` + `scrollBehavior()`
  헬퍼로 'smooth' → 'auto' 다운그레이드 (G024, 2 개 신규 테스트).

## 5. 통과 기준 (배포 게이트)

이 도구가 실무에 사용 가능하다고 선언하려면:

1. 모든 hard gate FAIL 항목이 PASS 로 전환
2. TODO 항목 중 C06 (E2E), C08 (Lighthouse), A02 (Lighthouse a11y) 가 최소 1회 측정되어 임계값 충족
3. `npm run verify:ci` 가 단일 명령으로 위 항목을 모두 강제

CI에 `npm run verify:ci` 를 hard gate 로 묶고, 본 문서의 모든 PASS 항목이 회귀 없이 유지될 때까지 main 브랜치는 보호된다.

## 6. 측정 자동화

본 문서의 각 지표는 `npm run verify:metrics` (추가 예정) 한 명령으로 일괄 측정되어 PASS/FAIL 행렬을 JSON 으로 출력한다. 출력은 PR 코멘트로 자동 게시되고, FAIL 항목이 1개라도 있으면 머지가 차단된다.
