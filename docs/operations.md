# Operations & Deployment Boundaries

> G016 — 본 문서는 현재 Workbench 가 "local DS automation tool" 인지 "production
> deployable service" 인지 정직하게 구분한다. 면접/협업 시 운영 경계 질문에 대한
> 단일 답변 소스다.

## TL;DR

```txt
이 프로젝트는 현재 local DS Automation Workbench 다.
Static hosting 단독으로는 preview / validation 흐름이 동작하지 않는다.
Production 배포에는 별도 server tier 와 temp workspace 정책이 필요하다.
```

## 1. 런타임 의존성

| Surface | 의존 | 비고 |
|---------|------|------|
| Chat / artifact 파싱 | 브라우저 only | 순수 함수, 어떤 hosting 에서도 동작 |
| Canvas preview | **Vite dev server** + **isolated loopback origin** | `/api/deepseek/preview-runs` 가 임시 TSX entry 와 의존성을 동적으로 컴파일. static asset 호스팅 단독으로는 불가 |
| Validation runner | **Node 서버** + **temp workspace 파일시스템** | `/api/deepseek/validate` 가 tmp dir 에 `node_modules`, `tsc`, `vitest` 등을 spawn |
| DeepSeek 프록시 | **서버 전용** (`/api/deepseek/chat`) | API key 는 서버 환경변수에서만 읽음 |
| Verified sample / Mock client | 브라우저 only | DeepSeek 호출 없이 결정적으로 동작 |

## 2. Local development (지금 상태)

```bash
npm install
npm run dev        # Vite dev server + same-origin API
# .env.local 에 DEEPSEEK_API_KEY=... 가 있어야 live 호출 가능
```

- 브라우저는 `http://localhost:5173` 만 접근.
- preview iframe 은 isolated loopback origin (예: `http://127.0.0.1:5174`) 로
  분리되어 same-origin 격리가 적용된다 (G006 trust boundary).
- temp workspace 는 OS tmpdir 하위 (`/tmp/vapor-preview-*`, `/tmp/vapor-
  generated-*`) 에 생성되고 Cleanup gate 가 매 validation 끝에 cleanup 한다.

## 3. Static hosting 제약 (Vercel/Netlify 등의 SPA 단독 호스팅)

다음 surface 는 **동작하지 않는다**:

- `/api/deepseek/chat`: DeepSeek API 프록시 (서버 secret 필요)
- `/api/deepseek/validate`: temp workspace 에 코드 작성 + tsc/vitest spawn 필요
- `/api/deepseek/preview-runs`: TSX entry 동적 컴파일 + isolated origin 발급

따라서 SPA-only 배포 시 사용 가능한 것은 **Verified sample run + Mock client**
경로 뿐이다. 이것만으로도 parser, Canvas runtime (mock data), validation UI 의
deterministic 동작은 시연 가능하지만, **live generation / live validation 은
불가**.

## 4. Production mode (미구현, 설계 기록)

실무 production deployment 를 위해 필요한 항목:

### 4.1 Server tier

- Node 런타임 (Node 20+).
- API route 3 개를 단일 process 또는 분리된 micro-service 로:
  - `chat`: SSE 프록시 (DeepSeek 호출)
  - `validate`: temp workspace 빌더 + runner (tsc / vitest / axe-core)
  - `preview-runs`: Vite SSR-like compile or pre-built bundler

### 4.2 Temp workspace 정책

- **Isolation**: 요청마다 신규 dir (`/tmp/vapor-{validate|preview}-{uuid}`).
- **Quota**: 디스크 사용량 cap + concurrent run limit.
- **Cleanup**:
  - Happy path: Cleanup gate 가 항상 마지막에 실행 (현재 구현 동일).
  - Crash path: TTL 기반 sweep cron (예: 1시간 이상 된 leftover 강제 제거).
  - Process restart: lock file 확인 후 fresh 시작 시 stale dir 정리.
- **`node_modules`**: 현재는 호출 시점에 npm 의존성 hoisting 기대. production
  은 pre-warmed cache 또는 base image bake 권장 (validation 응답 시간 단축).

### 4.3 API key 정책

- `DEEPSEEK_API_KEY` 는 **항상 서버 환경변수**. 브라우저로 노출 절대 금지.
- ESLint `no-restricted-imports` 규칙으로 `src/agent/**` 외부에서 직접 fetch 가
  DeepSeek endpoint 를 호출하는 것을 차단.
- key rotation: 서버 재시작 또는 hot-reload 환경변수 지원.

### 4.4 Preview origin

- Isolated origin (별도 hostname 또는 port) 필수 — same-origin 으로 두면
  generated artifact 가 호스트 페이지의 cookies/localStorage 접근 가능.
- production: subdomain (예: `preview.<host>`) + CSP `frame-ancestors` 제한.

## 5. CI hard gate vs 수동 smoke

`npm run verify:ci` 는 deterministic gate 만 강제한다:

```
typecheck → lint → unit → build → bundle budget → e2e (smoke 제외) →
verify:generated → verify:lighthouse → git diff
```

Live DeepSeek 호출은 모델/네트워크 변동성으로 CI hard gate 가 아니다 (G010):

```
npm run smoke:live-deepseek               # generation/canvas 까지 (G010)
npm run smoke:live-deepseek:validation    # Run validation 포함 (G012)
```

두 smoke 모두 `DEEPSEEK_API_KEY` 미설정 시 skip + exit 0 으로 종료한다.

## 6. Approval 의미

`현재 artifact 로컬 승인` 버튼 (G005) 은 **local review state** 다:

- 저장소 파일을 쓰지 않는다.
- PR 을 만들지 않는다.
- 어떤 외부 시스템에도 신호를 보내지 않는다.
- 동일 ArtifactRun id 에만 귀속되며 새 run 이 도착하면 자동으로 reset (G011).

승인 후 결과를 영구화하려면 후속 자동화 (PR generation, artifact export) 를
별도 surface 로 추가해야 한다 — 본 워크벤치는 그 자동화의 입력 / 검증 단계만
담당한다.

## 7. 한계와 not-tested 영역

정직한 비-검증 항목:

- live DeepSeek 응답 품질 자체는 검증 범위 외 (smoke 만 형식 확인).
- production-grade rate limiting / abuse prevention 미구현.
- 다중 사용자 동시성 + temp workspace 격리 stress test 미수행.
- Lighthouse 측정은 local Chrome headless 기준; 실 CDN edge 성능 차이 보장 없음.
- visual regression baseline 은 macOS Chromium 환경 기준. Linux CI 환경에서는
  font hinting/anti-aliasing 차이로 재생성 필요 가능.

## 8. 운영 체크리스트 (production 채택 시)

```
□ Node 20+ 서버 tier 프로비저닝
□ DeepSeek API key secret store 연결
□ temp workspace dir 마운트 + quota
□ TTL sweep cron 등록
□ isolated preview origin 발급 + CSP 설정
□ rate limit / abuse guard
□ Lighthouse / 에러 trace 모니터링 연결
□ verify:ci 를 CI 파이프라인에 hard gate 로 묶기
□ live smoke 는 별도 manual job (또는 nightly) 로 분리
□ approval 후속 자동화 (PR 생성 등) 명세
```
