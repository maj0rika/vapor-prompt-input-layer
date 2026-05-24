/**
 * G003 — 실패 fixture 격리 단위 테스트.
 *
 * 각 fixture 는 지정된 gate 에서만 fail 이 나며,
 * 나머지 gate 는 pass 또는 warn 임을 검증한다.
 *
 * 실제 gate 상태는 각 fixture 를 직접 실행해 확인한 결과다:
 *   typecheck-fail  : Typecheck=fail, Vapor token usage=fail, Unit/Runtime/Axe=pass
 *   runtime-fail    : Typecheck/Unit=pass, Runtime Render=fail, Axe=fail
 *   axe-fail        : Typecheck/Unit/Runtime Render=pass, Axe=fail
 *   metadata-fail   : Metadata contract=fail, Typecheck/Unit/Runtime/Axe=fail
 *   broken-token    : Vapor token usage=fail or warn, Typecheck/Unit/Runtime/Axe=pass
 */
import { describe, expect, it } from 'vitest';
import { validateGeneratedArtifact } from './validateGeneratedArtifact.ts';
import {
  TYPECHECK_FAIL_ARTIFACT,
  RUNTIME_FAIL_ARTIFACT,
  AXE_FAIL_ARTIFACT,
  WRONG_PRIMARY_EXPORT_ARTIFACT,
  BROKEN_ARTIFACT,
} from '../../src/agent/scripts.ts';

const TIMEOUT_MS = 120_000;

function getDetail(
  details: Array<{ label: string; status: string }>,
  label: string,
) {
  return details.find((d) => d.label === label);
}

describe.sequential('validateGeneratedArtifact — failure fixture gate isolation', () => {
  it(
    'typecheck-fail: Typecheck gate fails; Unit, Runtime Render, Axe pass',
    async () => {
      const result = await validateGeneratedArtifact(TYPECHECK_FAIL_ARTIFACT);

      expect(result.status).toBe('fail');
      expect(getDetail(result.details, 'Typecheck')?.status).toBe('fail');

      // Unit / RuntimeRender / Axe must not fail
      // (typecheck-fail component still transpiles fine under vitest jsdom)
      expect(getDetail(result.details, 'Unit')?.status).toBe('pass');
      expect(getDetail(result.details, 'Runtime Render')?.status).toBe('pass');
      expect(getDetail(result.details, 'Axe')?.status).toBe('pass');
    },
    TIMEOUT_MS,
  );

  it(
    'runtime-fail: Runtime Render and Axe gates fail; Typecheck and Unit pass',
    async () => {
      const result = await validateGeneratedArtifact(RUNTIME_FAIL_ARTIFACT);

      expect(result.status).toBe('fail');
      expect(getDetail(result.details, 'Typecheck')?.status).toBe('pass');
      expect(getDetail(result.details, 'Unit')?.status).toBe('pass');
      // Component throws on render → both RuntimeRender and Axe fail
      expect(getDetail(result.details, 'Runtime Render')?.status).toBe('fail');
      expect(getDetail(result.details, 'Axe')?.status).toBe('fail');
    },
    TIMEOUT_MS,
  );

  it(
    'axe-fail: only Axe gate fails; Typecheck, Unit, Runtime Render pass',
    async () => {
      const result = await validateGeneratedArtifact(AXE_FAIL_ARTIFACT);

      expect(result.status).toBe('fail');
      expect(getDetail(result.details, 'Typecheck')?.status).toBe('pass');
      expect(getDetail(result.details, 'Unit')?.status).toBe('pass');
      expect(getDetail(result.details, 'Runtime Render')?.status).toBe('pass');
      expect(getDetail(result.details, 'Axe')?.status).toBe('fail');
    },
    TIMEOUT_MS,
  );

  it(
    'metadata-fail: Metadata contract gate fails; Typecheck, Unit, Runtime Render, Axe also fail due to wrong primaryExport in generated tests',
    async () => {
      const result = await validateGeneratedArtifact(WRONG_PRIMARY_EXPORT_ARTIFACT);

      expect(result.status).toBe('fail');
      // The primary signal: Metadata contract
      expect(getDetail(result.details, 'Metadata contract')?.status).toBe('fail');
      // Cascade: generated runtime tests reference the wrong primaryExport name
      expect(getDetail(result.details, 'Typecheck')?.status).toBe('fail');
      expect(getDetail(result.details, 'Unit')?.status).toBe('fail');
      expect(getDetail(result.details, 'Runtime Render')?.status).toBe('fail');
      expect(getDetail(result.details, 'Axe')?.status).toBe('fail');
    },
    TIMEOUT_MS,
  );

  it(
    'broken-token: Vapor token usage gate is non-pass; Typecheck, Runtime Render, Axe pass',
    async () => {
      const result = await validateGeneratedArtifact(BROKEN_ARTIFACT);

      // Token gate is the primary non-pass signal
      const tokenDetail = getDetail(result.details, 'Vapor token usage');
      expect(tokenDetail?.status === 'warn' || tokenDetail?.status === 'fail').toBe(true);

      // The component itself typechecks, renders, and has no axe violations
      expect(getDetail(result.details, 'Typecheck')?.status).toBe('pass');
      expect(getDetail(result.details, 'Runtime Render')?.status).toBe('pass');
      expect(getDetail(result.details, 'Axe')?.status).toBe('pass');
    },
    TIMEOUT_MS,
  );
});
