# Reality Check

Last audited baseline: 2026-05-24 local verified metadata contract + Canvas runtime lifecycle.

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
| Component/story/test parsing | user-verifiable | Delimiter parser tests, artifact workspace tabs, and `<artifact-meta>` contract | LLMs can still omit metadata; UI must show heuristic fallback warning. |
| Code artifact display | ui-visible | Component / Story / Test tabs | Code display is not a Canvas preview. |
| Live DeepSeek validation endpoint | user-verifiable | `/api/deepseek/validate`, `verify:generated`, Run validation E2E | Static hosting still needs equivalent server/serverless proxy. |
| Verified sample run | user-verifiable | Run verified sample loads a deterministic fixture, renders Canvas, keeps validation waiting, and gates approval on `/api/deepseek/validate` output | This proves the pipeline path, not live DeepSeek model quality. |
| Generated component Canvas | user-verifiable | Canvas tab loads `/api/deepseek/preview`, Vite transforms the generated TSX entry, iframe posts ready/error, and iframe DOM exposes the generated button in E2E | Complex prop controls still need a dedicated Props panel. |
| Variant and theme switching | user-verifiable | Canvas controls use `<artifact-meta>` variants when present and switch Default/Disabled and Light/Dark in E2E | Complex prop controls still need a dedicated Props panel. |
| Runtime render result | user-verifiable | Tests tab shows Runtime Render runner detail across metadata variants and Canvas mounts React output through preview runtime | Runtime runner and Canvas runtime still use separate temp workspaces. |
| Failure states | user-verifiable | Broken raw-color artifact E2E shows FAIL and runner detail | More failure fixtures can be added for type/unit/axe-specific failures. |
| Repair loop | user-verifiable | Fix with Agent sends failed gates and validation result into the next request | Current deterministic mock repairs to a known passing component. |
| Approval gate | user-verifiable | Approve current artifact stays disabled until validation status is pass | Persistence/export of approved artifacts is not implemented. |

## Non-Overclaim Rule

Do not describe Markdown code tabs as component preview. Do not call validation
complete unless the real runner output is visible for the artifact being
reviewed. Mock E2E is valid for deterministic UI coverage, but it is not proof
of real DeepSeek network behavior.
