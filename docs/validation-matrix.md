# Validation Matrix

This matrix separates verified MVP behavior from final portfolio gates. Evidence
levels are defined in [Reality Check](./reality-check.md).

## Current Status

| Area | Status | Evidence level | Evidence |
| --- | --- | --- |
| Product concept | implemented | ui-visible | Vapor DS Automation Agent UI |
| DeepSeek proxy | implemented | script-verified | same-origin `/api/deepseek/chat` stream smoke |
| Artifact parser | implemented | script-verified | `src/agent/responseParser.ts` tests |
| Artifact metadata contract | implemented | user-verifiable | `<artifact-meta>` parses primary export, default props, and variants; Canvas shows Metadata contract |
| Token usage static check | implemented | script-verified | `src/agent/tokenUsage.ts` tests |
| Artifact workspace | implemented | ui-visible | Component / Story / Test / Validation tabs |
| Inline attachment composer | implemented | user-verifiable | `.json/.ts/.tsx/.md/.txt` text extraction |
| Generated typecheck runner | implemented | script-verified | `npm run verify:generated` |
| Generated Vitest runner | implemented | script-verified | temp workspace Vitest |
| Generated Axe runner | implemented | script-verified | runtime `jest-axe` test |
| Live validation endpoint | implemented | user-verifiable | Run validation calls `/api/deepseek/validate` from the workspace |
| Verified sample run | implemented | user-verifiable | deterministic fixture uses same parser, Canvas runtime, and `/api/deepseek/validate`; no DeepSeek chat call |
| Generated component Canvas | implemented | user-verifiable | sandbox iframe preview from `/api/deepseek/preview` Vite-transformed TSX entry |
| Canvas runtime lifecycle | implemented | user-verifiable | iframe posts ready/error messages and parent UI shows runtime ready/failed |
| Variant/theme controls | implemented | user-verifiable | Default/Disabled and Light/Dark controls covered by E2E |
| Failure states | implemented | user-verifiable | broken raw-color artifact shows FAIL runner details |
| Repair loop | implemented | user-verifiable | failed gates are sent back through Fix with Agent |
| Approval gate | implemented | user-verifiable | approval is disabled until all gates pass |
| Bundle budget | implemented | script-verified | `npm run verify:bundle` enforces initial JS gzip <= 200KB |
| Lighthouse budget | implemented | script-verified | `npm run verify:lighthouse` enforces app quality scores and vitals |

## AI Agent Behavior

| Requirement | Pass criteria | Current |
| --- | --- | --- |
| delimiter parse | component/story/test/a11y/token extracted | pass |
| artifact metadata | primaryExport/defaultProps/variants extracted and used by Canvas/runtime harness | pass |
| malformed output | no app crash | parser and DeepSeek SSE tests pass |
| mode routing | each mode changes prompt context | pass |
| attachment context | text included in request payload | pass |
| prompt injection defense | attachments treated as untrusted | prompt-level only |
| DeepSeek stream | `[DONE]`, malformed SSE, abort, network error handled | pass |
| validation pending/result | generated completion then real result display for live DeepSeek artifacts | pass |
| verified sample honesty | sample is labeled deterministic and does not call DeepSeek before validation | pass |
| mock mode | deterministic E2E response | pass |

## Generated Artifact Validation

| Step | Owner module | Pass criteria | Status |
| --- | --- | --- | --- |
| parse | `src/agent/responseParser.ts` | component/story/test found | pass |
| metadata | `src/agent/responseParser.ts` | primary export and preview props found when provided | pass |
| temp workspace | `server/validation/createTempWorkspace.ts` | isolated temp dir created | pass |
| file write | `server/validation/writeGeneratedFiles.ts` | generated files written | pass |
| typecheck | `server/validation/validateGeneratedArtifact.ts` | TS error 0 | pass |
| unit | `server/validation/validateGeneratedArtifact.ts` | generated tests pass | pass |
| runtime render | `server/validation/validateGeneratedArtifact.ts` | component mounts in runtime harness | pass |
| axe | `server/validation/validateGeneratedArtifact.ts` | violations 0 | pass |
| token | `server/validation/validateGeneratedArtifact.ts` | fail 0, warn below threshold | pass |
| aggregate | `server/validation/validateGeneratedArtifact.ts` | normalized result | pass |
| CLI | `server/validation/run-generated-validation.ts` | exits 0 only when all pass | pass |

## E2E Expansion

Required scenarios:

| Scenario | Status |
| --- | --- |
| empty state + artifact empty workspace | pass |
| component generation + validation badges | pass |
| file attach content | pass |
| unsupported file rejection | pass |
| maxFiles across repeated attachments | pass |
| A11y Audit with TSX attachment | pass |
| Token Sync with token JSON | pass |
| abort | pass |
| error recovery | pass |
| keyboard-only flow | pass |
| copy action | pass |
| Canvas render | pass |
| Canvas ready/error lifecycle | pass |
| variant/theme switch | pass |
| Run validation from UI | pass |
| validation failure state | pass |
| repair and re-validate loop | pass |
| approve only after pass | pass |
| verified sample no-chat + real validation gate | pass |

## Interview Positioning

Say:

```txt
The product shell, prompt routing, artifact parsing, token check, live
validation endpoint, and fixture generated-artifact validation are implemented.
Deterministic UI paths are labeled as fixtures. The verified sample run does not
call DeepSeek, but it does use the same artifact parser, Canvas preview runtime,
and `/api/deepseek/validate` runner as live artifacts. npm run verify:generated
remains the CLI generated code gate.
```

Do not say:

```txt
All generated code from arbitrary LLM responses is fully verified in production.
```

This local portfolio demo verifies live DeepSeek artifacts through the Vite
server endpoint. Static hosting would still need a server or serverless proxy for
the same guarantee.
