# Production Metrics — 실무 활용 절대 지표

> 이 문서는 Vapor Design System 자동화 워크벤치가 "실무 검증 도구"로
> 사용 가능한지를 판정하는 **절대 측정 지표** 를 정의한다. 모든 항목은
> 명시된 명령으로 자동 측정 가능하며, 임계값을 충족하지 않으면 PR/배포
> 가 통과되지 않는다.

베이스라인 측정일: 2026-05-26 (main @ 379a6f9)

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
| S01 | LLM 파일명 path traversal 차단 | `grep -nE 'basename\\(.*filename' src/agent/responseParser.ts server/validation/writeGeneratedFiles.ts \|\| true` 후 `npm test -- responseParser sanitize` | filename basename 검증 1건 이상 + `..`/`/` 거부 테스트 PASS | **FAIL** |
| S02 | preview iframe 트러스트 경계 | `grep -nE 'sandbox=' src/components/chat/PreviewPanel.tsx` | `allow-same-origin` 미포함 | **FAIL** |
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
| C08 | Lighthouse budget | `npm run verify:lighthouse` | Perf>=90 a11y>=95 BP>=95 SEO>=90 LCP<=2.5s CLS<=0.1 | (측정 필요) |

### Trust Boundary

| ID | 지표 | 측정 명령 | 임계값 | 현재 |
|----|------|-----------|--------|------|
| T01 | preview iframe 격리 | S02 + isolated loopback origin 분기 존재 | `createIsolatedPreviewOrigin` 호출 1건 이상, `allow-same-origin` 없음 | **FAIL (S02 위반)** |
| T02 | 동시 validation 격리 | `grep -nE 'activeRuns?\\\|MAX_CONCURRENT\\\|429' server/validation/validationProxy.ts` | 카운터 + 초과 시 429 응답 | **FAIL** |
| T03 | temp workspace 누수 차단 | 동시 run 5회 + crash 1회 시뮬레이션 후 `ls /tmp/vapor-* \| wc -l` | 0개 (60분 경과) | (측정 필요) |
| T04 | 자식 프로세스 강제 종료 | `grep -n 'SIGKILL' server/validation/runCommand.ts` | SIGTERM 이후 escalation 존재 | **FAIL** |

### UX Coherence

| ID | 지표 | 측정 명령 | 임계값 | 현재 |
|----|------|-----------|--------|------|
| U01 | 영문/한국어 혼용 레이블 | `grep -nE '\"Tests\"\\|TAB_LABELS' src/components/chat/PreviewPanel.tsx` | validation 탭 한국어 레이블 | **FAIL ('Tests')** |
| U02 | 키보드 only 완주 | Playwright `tests/keyboard-only.spec.ts` | generate → validate → approve 100% 통과 | (필요시 추가) |
| U03 | 실패 복구 경로 가시 | `grep -n 'onRepairGate' src/components/chat/PreviewPanel.tsx` | `onRepairGate` 콜백 함수가 ValidationPanel에 전달 | PASS |
| U04 | 응답 인내심 신호 | `grep -nE 'aria-busy\\|role=\"status\"\\|Spinner' src/components/chat/ValidationPanel.tsx src/components/chat/PreviewPanel.tsx` | 적어도 1건 | (필요시 추가) |
| U05 | 승인 의미 명시 | `grep -n 'PR.*생성.*않' src/components/chat/PreviewPanel.tsx` | "파일/PR 생성 없음" 안내 1건 이상 | PASS |
| U06 | 반복 수정 가드 | `grep -nE 'repairAttemptCount\\\|repairCount' src/components/chat/ChatScreen.tsx` | UI 상 카운터 + 한도 초과 시 disabled | **FAIL** |
| U07 | 다크모드 UI 적용 | `grep -rn 'dark:' src/ \| wc -l` 또는 vapor `ThemeProvider` shell 전환 코드 존재 | app shell 컴포넌트가 light/dark 둘 다 시각적 차이 발생 | **FAIL** |

### Vapor DS Conformance

| ID | 지표 | 측정 명령 | 임계값 | 현재 |
|----|------|-----------|--------|------|
| V01 | 도구 자체의 raw hex | `grep -rEn '#[0-9a-fA-F]{3,6}\\b' src/components/ --include='*.tsx' \| grep -v '.test.'` | 0건 (iframe CSS 포함) | **FAIL (14건 PreviewPanel:914-930)** |
| V02 | 도구 자체의 raw px in inline style | `grep -rEn 'style=.*\\d+px' src/components/` | 0건 | PASS |
| V03 | 도구 자체의 Tailwind gap-N(v-* 비사용) | `grep -rEn '\\b(gap\\|p\\|m)-[0-9]\\b' src/components/ \| grep -v -- '-v-'` | 0건 | **FAIL (다수)** |
| V04 | 생성물 token gate (raw color) | `npm run verify:generated` 결과 token detail | rawColorCount 0 | PASS (fixture) |
| V05 | 생성물 token gate (hsl/oklch/named) | `tests/token-usage.spec.ts` 확장 | hsl/oklch 감지 가능, false negative 0 | **FAIL (regex 누락)** |
| V06 | ESLint 경계 위반 | `npm run lint` | 0건 (Vapor/agent boundary 강제) | PASS |

### Operational Robustness

| ID | 지표 | 측정 명령 | 임계값 | 현재 |
|----|------|-----------|--------|------|
| O01 | 동시 validation 한도 | T02 동일 | semaphore 활성 | **FAIL** |
| O02 | timeout 시 자식 프로세스 강제 종료 | T04 동일 | SIGKILL escalation | **FAIL** |
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
| A02 | 도구 자체 a11y | `npm run verify:lighthouse` | Lighthouse a11y >= 95 | (측정 필요) |
| A03 | iframe title | `grep -n 'title=' src/components/chat/PreviewPanel.tsx \| grep iframe` | 1건 이상 | PASS ("Generated artifact canvas") |
| A04 | tab/tabpanel ARIA 페어 | `grep -nE 'role=\"tablist\\\|tab\\\|tabpanel\"' src/components/chat/PreviewPanel.tsx` | tab, tabpanel 모두 존재 + aria-labelledby 연결 | (확인 필요) |
| A05 | reduced motion 대응 | `grep -rn 'prefers-reduced-motion' src/` | 1건 이상 | **FAIL** |

## 3. 게이트 매트릭스 (현재 베이스라인)

```
PASS  : C01 C02 C03 C04 C05 C07   S03 S04 S05   T없음   U03 U05   V02 V04 V06   O03 O04 O05   P03 P05   A01 A03
FAIL  : S01 S02   T01 T02 T04   U01 U06 U07   V01 V03 V05   O01 O02   A05
TODO  : C06 C08   T03   U02 U04   P01 P02 P04   A02 A04
```

총 PASS: 22 / FAIL: 13 / 측정 보류: 11

## 4. FAIL 지표 — 즉시 차단 사유

각 FAIL 항목은 "실무 활용 가능한 검증 도구"라는 약속을 깨뜨린다.

- **S01 (path traversal)** — LLM 응답 안의 `filename="../../../etc/passwd"` 가 서버 파일시스템에 쓰여진다. 단일 사용자라 해도 자기 자신의 작업 트리를 손상시킬 수 있고, 외부 노출 시 RCE 직전 단계.
- **S02 (iframe allow-same-origin)** — 생성 컴포넌트가 `window.parent.localStorage`/`document.cookie` 를 읽고 수정 가능. preview 의 격리 약속이 무력화됨.
- **T02/O01 (동시 validation 가드 없음)** — 더블 클릭 또는 멀티 탭 시 4N vitest 자식 프로세스가 동시에 spawn 되어 디스크/CPU 고갈 + 결과 신뢰성 손상.
- **T04/O02 (SIGTERM only)** — 30s 타임아웃 후에도 vitest worker thread 가 좀비로 남아 다음 run을 오염.
- **U01 ('Tests' 레이블)** — 한국어 UI 안에 영문 탭 + "검증" 어휘와 불일치. 첫 사용자가 validation 탭을 찾지 못함.
- **U06 (repair 무한 클릭)** — 토큰 게이트 반복 실패 시 사용자가 같은 prompt 로 무제한 retry → 비용/시간 손실.
- **U07 (다크모드 미적용)** — 토글 버튼이 작동하지 않는 것처럼 보임 (실제로는 Canvas iframe 안에만 적용).
- **V01 (raw hex 14건)** — 도구 본체가 자신의 검증 규칙을 위반. Vapor 토큰이 갱신되어도 preview 색상은 변하지 않음.
- **V03 (raw gap-N)** — 동일 사유. spacing scale 일관성 깨짐.
- **V05 (hsl/oklch 미탐지)** — DeepSeek 가 modern CSS 색상을 쓸 때 token gate 가 silently PASS 하여 잘못된 PR 승인 위험.
- **A05 (reduced motion 미대응)** — `scrollIntoView({behavior: 'smooth'})` 가 prefers-reduced-motion 사용자에게도 강제 적용.

## 5. 통과 기준 (배포 게이트)

이 도구가 실무에 사용 가능하다고 선언하려면:

1. 모든 hard gate FAIL 항목이 PASS 로 전환
2. TODO 항목 중 C06 (E2E), C08 (Lighthouse), A02 (Lighthouse a11y) 가 최소 1회 측정되어 임계값 충족
3. `npm run verify:ci` 가 단일 명령으로 위 항목을 모두 강제

CI에 `npm run verify:ci` 를 hard gate 로 묶고, 본 문서의 모든 PASS 항목이 회귀 없이 유지될 때까지 main 브랜치는 보호된다.

## 6. 측정 자동화

본 문서의 각 지표는 `npm run verify:metrics` (추가 예정) 한 명령으로 일괄 측정되어 PASS/FAIL 행렬을 JSON 으로 출력한다. 출력은 PR 코멘트로 자동 게시되고, FAIL 항목이 1개라도 있으면 머지가 차단된다.
