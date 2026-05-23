# Quality Gates

This portfolio is not complete when the UI looks plausible. It is complete only
when generated Vapor Design System artifacts pass real verification gates.

## Definition Of Done

```txt
generate -> parse -> preview -> real temp workspace validation
-> performance/accessibility/token/test gates
-> pass/fail result displayed in the UI
```

## Static Code Gate

Every commit must pass:

| Gate | Command | Pass criteria |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | error 0 |
| ESLint | `npm run lint` | error 0 |
| Unit/integration | `npm test` | all tests pass |
| Build | `npm run build` | production build succeeds |
| Bundle budget | `npm run verify:bundle` | initial JS gzip <= 200KB |
| Lighthouse | `npm run verify:lighthouse` | Performance >= 90, Accessibility >= 95, Best Practices >= 95, SEO >= 90, LCP <= 2.5s, CLS <= 0.1 |
| E2E | `npm run test:e2e` | all Playwright tests pass |
| Diff whitespace | `git diff --check` | no whitespace errors |
| Secret check | manual/CI grep | no API key, `.env.local`, token, or `sk-` in committed files |
| Git state | `git status --short` | no unintended files |

Local aggregate command:

```bash
npm run verify
npm run verify:ci
```

## Coverage Gate

Minimum portfolio bar:

| Area | Minimum | Target |
| --- | ---: | ---: |
| Statements | 85% | 90% |
| Branches | 80% | 85% |
| Functions | 85% | 90% |
| Lines | 85% | 90% |
| Core agent modules | 90% | 95% |
| Parser/token/generated validation | 95% | near 100% |

Strict targets:

```txt
src/agent/promptBuilder.ts       95%+
src/agent/responseParser.ts      95%+
src/agent/tokenUsage.ts          95%+
src/agent/DeepSeekAgentClient.ts 90%+
server/validation/*              90%+
```

## Generated Artifact Gate

`npm run verify:generated` runs the generated artifact pipeline against the
fixture artifact in `server/validation/fixtures/primary-button-artifact.md`.

| Gate | Pass criteria |
| --- | --- |
| Artifact parse | component, story, test extracted |
| File write | files written to temp workspace |
| TypeScript | generated component/story/test typecheck error 0 |
| Unit test | generated tests pass |
| Story syntax | `.stories.tsx` imports and metadata typecheck |
| Runtime render | Testing Library render does not crash |
| Axe | violations 0 |
| Token usage | fail 0, warn within threshold |
| Cleanup | temp workspace removed even after failure |

Current implemented runner:

```txt
parse -> temp workspace -> file write -> tsc --noEmit
-> Vitest generated tests -> runtime jest-axe check -> token gate -> cleanup
```

Passing result:

```txt
Typecheck: PASS
Unit: PASS
Axe: PASS
Token: PASS or WARN below threshold
Runtime render: PASS
```

## Vapor Token Gate

MVP threshold:

```txt
fail count = 0
raw color count = 0
raw radius count <= 1
raw spacing count <= 2
Vapor token or primitive reference >= 2
```

Final strict threshold:

```txt
raw color count = 0
raw spacing count = 0
raw radius count = 0
inline visual style count = 0
```

Signals:

| Signal | Severity |
| --- | --- |
| raw hex color | fail |
| `rgb(...)`, `rgba(...)`, `hsl(...)` | warn/fail |
| raw spacing px | warn |
| raw radius px | warn |
| arbitrary Tailwind value | warn |
| inline visual style abuse | warn |
| Vapor primitive/token reference | pass signal |
| missing disabled/loading/focus state | warn |

## Accessibility Gate

Automated:

| Gate | Pass criteria |
| --- | --- |
| axe violations | 0 |
| role query | major elements reachable by `getByRole` |
| accessible name | controls have label or aria-label |
| keyboard | Tab, Enter, Space, Escape paths work |
| disabled state | click/submit blocked |
| loading state | `aria-busy` or explicit status |
| form label | input labels exist |

Manual:

```txt
- keyboard-only full flow
- focus order matches visual flow
- validation badges do not rely on color only
- loading/error state is screen-reader explainable
- file attach works without drag/drop
```

## Performance Gate

App:

| Metric | Minimum | Target |
| --- | ---: | ---: |
| Lighthouse Performance | 90+ | 95+ |
| Lighthouse Accessibility | 95+ | 100 |
| Lighthouse Best Practices | 95+ | 100 |
| Lighthouse SEO | 90+ | 95+ |
| LCP | <= 2.5s | <= 1.8s |
| INP | <= 200ms | <= 150ms |
| CLS | <= 0.1 | <= 0.05 |
| console errors | 0 | 0 |
| Initial JS gzip | <= 200KB | <= 150KB |

Agent pipeline:

| Metric | Pass criteria |
| --- | ---: |
| first token | <= 3s |
| artifact parse | <= 100ms |
| token usage check | <= 100ms |
| temp workspace validation | <= 15s |
| validation timeout | 30s hard timeout |
| abort after state update | none |

## Commit Rule

Commit only after the relevant gate passes. Commit body must include `Tested` and
`Not-tested`. Mock validation must never be described as real validation.
