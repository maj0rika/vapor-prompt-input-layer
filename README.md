# Vapor DS Automation Workbench

Vapor Design System 기반 컴포넌트 생성, Storybook 스토리 작성, Vitest 테스트,
접근성 검증을 자연어 에이전트로 자동화하는 포트폴리오 케이스 스터디입니다.

목표는 단순 채팅 UI 가 아니라 DS 엔지니어의 반복 작업을 줄이고 산출물 품질을
높이는 자동화 워크플로우입니다. 사용자는 컴포넌트 요구사항과 참고 파일을
입력하고, 에이전트는 Vapor 기준에 맞는 artifact 를 생성해 workspace 에 분리해
보여줍니다. 현재 코드는 parser, validation runner, artifact tabs 까지 검증됐고,
생성 컴포넌트는 Canvas 탭의 sandboxed iframe 에 렌더링되며, 기본/비활성 variant 와
light/dark theme 를 전환할 수 있습니다. React 컴포넌트 artifact 는 Vite preview
runtime 이 temp TSX entry 로 변환해 실제 React DOM 으로 mount 합니다.
Tests 탭에서는 UI에서 직접 real validation runner 를 실행할 수 있고, 실패한 gate는
Fix with Agent 루프로 다시 보내 재생성·재검증한 뒤 모든 gate가 통과해야 approve 할 수
있습니다.

> 데모: 로컬에서 `npm run dev` 로 실행할 수 있습니다. DeepSeek 연결은
> `.env.local` 의 `DEEPSEEK_API_KEY` 를 서버 프록시에서만 읽습니다.

## Verified Sample Run

면접 첫 30초에는 **Run verified sample** 로 deterministic fixture 를 로드할 수
있습니다. 이 샘플은 DeepSeek 를 호출하지 않으며 UI 에도 `No DeepSeek call` 로
표시됩니다. 다만 artifact parser, Canvas preview runtime, `/api/deepseek/validate`
runner 는 실제 생성물과 동일한 경로를 사용합니다.

샘플 로드 직후에는 Canvas 와 Component/Story/Test artifact 만 준비되고,
Validation 은 waiting 상태로 남습니다. PASS badge 와 Approve current artifact 는 사용자가
Run validation 을 눌러 실제 runner output 이 반환된 뒤에만 활성화됩니다. 이 기능은
모델 품질을 과장하지 않고 generate -> render -> validate -> approve 흐름을
안정적으로 증명하기 위한 trust-preserving demo path 입니다.

## Engineering Focus

1. **Vapor 업무 맥락** — Component, Token Sync, A11y Audit, Story/Test 모드로
   DS 자동화 intent 를 명확히 라우팅
2. **구조화된 artifact 출력** — LLM 응답을 delimiter 기반 artifact-meta,
   component/story/test artifact 로 파싱하고 preview tab 으로 분리
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

생성 완료 후 artifact 를 파싱하고 `/api/deepseek/validate`가 실제 temp workspace
runner 를 호출합니다. Vapor token usage 는 raw hex, `rgb(...)`, hard-coded `px`
spacing/radius, arbitrary style 사용을 탐지해 pass/warn/fail 로 판정합니다.
Validation 상태와 Approve current artifact 는 runner output 이 돌아온 뒤에만 갱신됩니다.
Canvas 와 runtime validation 은 `<artifact-meta>`를 LLM hint 가 아니라 validated
render contract 로 취급합니다. metadata 가 있으면 `primaryExport`는 실제 component
export 와 정확히 일치해야 하며, strict lookup 이 실패해도 `Object.values` fallback 으로
성공처럼 보이지 않습니다. metadata 가 없을 때만 화면에 heuristic preview warning 을
표시합니다. Preview iframe 은 `ready/error` lifecycle 을 parent UI 로 보내며, runtime
mount 실패는 `Canvas runtime: failed` 로 노출됩니다. Parent 는 preview iframe 의
`event.source`, isolated preview origin, `previewRunId`, variant/theme, message type 을
모두 확인한 뒤에만 Canvas lifecycle 신호를 신뢰합니다. Preview 는 parent 와 다른
loopback host origin 에서 로드되며 parent 는 iframe `contentDocument`를 읽지 않습니다.
Runtime Render 와 Axe generated tests 는 metadata variants 전체를 순회합니다.

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

## Live DeepSeek Smoke

Live DeepSeek smoke 는 CI hard gate 가 아닙니다.

응답 변동성으로 flaky 할 수 있으며 `verify:ci` / `test:e2e` 에 포함되지 않습니다.
별도 `playwright.smoke.config.ts` + `testIgnore: '**/*.smoke.spec.ts'` 로 격리되어
기본 E2E 실행에 절대 포함되지 않습니다. API key 가 없으면 suite 전체가 skip
되고 exit 0 으로 종료됩니다.

```bash
# generation/canvas 까지만 (빠른 smoke)
DEEPSEEK_API_KEY=... npm run smoke:live-deepseek

# 위 + Run validation 까지 포함 (느린 smoke, G012)
DEEPSEEK_API_KEY=... npm run smoke:live-deepseek:validation
```

### smoke scope 분할 (G012)

두 smoke 모두 CI hard gate 가 아니며 별도 Playwright config 로 격리됩니다.

| 확인 | `smoke:live-deepseek` | `smoke:live-deepseek:validation` |
|-----|:--:|:--:|
| 자연어 prompt → assistant 응답 done | ✓ | ✓ |
| raw `<artifact>` / `<artifact-meta>` / ` ```tsx ` leakage 절대 금지 | ✓ | ✓ |
| Component / Story / Test 탭 노출 | ✓ | — |
| Canvas iframe mount + runtime status settled | ✓ | — |
| Run validation 클릭 → ValidationPanel 노출 | — | ✓ |
| 전체 상태 badge (Pass/Fail/Warn) settled | — | ✓ |
| Fail 시 failure reason UI 노출 (validation-output-*) | — | ✓ |
| Approve 버튼 invariant 확인 (Pass=enabled, Fail=disabled) | — | ✓ |

validation smoke 는 모델/네트워크 변동성으로 더 flaky 하므로 별도 명령으로
분리됩니다. validation 결과가 Fail 이어도 failure reason 이 UI 에 보이면 smoke
자체는 통과합니다. 단 raw artifact leakage 는 둘 다 hard fail.

### live 경로를 우회하지 않으려면

Starter 템플릿 (Primary Button 등) 클릭은 deterministic fixture 를 로드하므로
live DeepSeek 호출이 발생하지 않습니다. smoke 는 PromptBar 에 직접 텍스트를
입력해 live 경로를 강제합니다.

## Ultragoal Acceptance (G001–G010)

이 프로젝트는 10개의 ultragoal story 로 완료 조건을 정의합니다. 각 story 는
production 코드 + unit/integration 테스트 + E2E spec 으로 증명됩니다.

| ID | Story | 증명 |
|----|-------|------|
| G001 | Built-in template mode contracts | `tests/templates-deterministic.spec.ts` |
| G002 | Happy path validation (`verify:generated`) | `npm run verify:generated` (6 gates) |
| G003 | Failure fixtures fail at designated gates | `server/validation/validateGeneratedArtifact.test.ts` |
| G004 | Repair loop with failure context | `src/agent/promptBuilder.test.ts`, `tests/repair-context.spec.ts` |
| G005 | Approve gating (current artifactRun only) | `tests/approve-gating.spec.ts`, `src/components/chat/PreviewPanel.test.tsx` |
| G006 | Canvas preview lifecycle (timeout 4번째 상태 포함) | `src/components/chat/PreviewPanel.test.tsx`, `tests/preview-runtime.spec.ts` |
| G007 | Token Sync non-visual contract | `tests/templates-deterministic.spec.ts` (B) |
| G008 | Structured ValidationPanel UI | `src/components/chat/ValidationPanel.test.tsx` |
| G009 | Workflow proof (E2E + visual + docs) | `tests/visual-regression.spec.ts`, 본 문서 |
| G010 | Live DeepSeek smoke 분리 | `playwright.smoke.config.ts`, `tests/live-deepseek.smoke.spec.ts` |

검증 명령:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e          # 모든 E2E (smoke 제외, visual regression 포함)
npm run verify:generated  # temp workspace 실 runner
DEEPSEEK_API_KEY=... npm run smoke:live-deepseek  # 선택, CI hard gate 아님
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
