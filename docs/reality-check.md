# Reality Check

Last audited commit: `4aa4cd8`

This document separates CLI proof from user-visible proof. The workbench is not
complete until generated artifacts render in a sandboxed Canvas and validation
can be inspected and repaired from the UI.

## Evidence Levels

| Level | Meaning |
| --- | --- |
| not-started | No implementation exists. |
| implemented | Code exists, but proof is limited. |
| script-verified | Automated CLI/unit/integration proof exists. |
| ui-visible | The user can see the behavior in the app. |
| user-verifiable | The user can operate the behavior and inspect results. |
| production-ready | The behavior is hardened for deployment/runtime constraints. |

## Current Truth

| Capability | Evidence level | Evidence | Gap |
| --- | --- | --- | --- |
| Natural-language Vapor request | user-verifiable | Composer, mode selector, attachment flow, E2E coverage | Needs repair-loop payload extension later. |
| Component/story/test parsing | ui-visible | Delimiter parser tests and artifact workspace tabs | Missing artifact metadata for primary export, variants, and default props. |
| Code artifact display | ui-visible | Component / Story / Test tabs | Code display is not a Canvas preview. |
| Live DeepSeek validation endpoint | script-verified | `/api/deepseek/validate`, `verify:generated` | UI has no explicit Run validation action yet. |
| Generated component Canvas | ui-visible | Canvas tab renders a sandboxed iframe from parsed artifact/story metadata | Full TSX compiler runtime is still pending. |
| Variant and theme switching | user-verifiable | Canvas controls switch Default/Disabled and Light/Dark in E2E | More generated metadata is needed for arbitrary variants. |
| Runtime render result | not-started | Runner has Axe smoke render only | Must be visible as a first-class validation gate. |
| Failure states | implemented | Runner can return fail details | Need broken-artifact UI fixture and E2E. |
| Repair loop | not-started | None | Failed validation must feed the next agent request. |
| Approval gate | not-started | None | Approve only after all gates pass. |

## Non-Overclaim Rule

Do not describe Markdown code tabs as component preview. Do not call validation
complete unless the real runner output is visible for the artifact being
reviewed. Mock E2E is valid for deterministic UI coverage, but it is not proof
of real DeepSeek network behavior.
