import { describe, expect, it } from 'vitest';
import { normalizeAgentRequest } from './chatProxy';

describe('normalizeAgentRequest', () => {
  it('text 가 비어 있으면 400-style error 를 돌려준다', () => {
    const result = normalizeAgentRequest({ text: '   ' });
    expect(result.ok).toBe(false);
  });

  it('text 만 있으면 mode 기본값(component)으로 정규화한다', () => {
    const result = normalizeAgentRequest({ text: 'hello' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ text: 'hello', mode: 'component' });
  });

  it('repair 필드를 보존한다 — Fix with Agent 회귀 방지', () => {
    const result = normalizeAgentRequest({
      text: '실패한 게이트만 고쳐줘',
      mode: 'component',
      previousArtifactSource: '<artifact>...prior code...</artifact>',
      validationResult: {
        details: [{ label: 'Typecheck', status: 'fail', message: 'T2304' }],
      },
      repairIntent: {
        failedGates: ['typecheck'],
        maxAttempts: 1,
        parentRunId: 'run-abc',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.previousArtifactSource).toContain('prior code');
    expect(result.value.validationResult).toMatchObject({
      details: [{ label: 'Typecheck', status: 'fail' }],
    });
    expect(result.value.repairIntent).toEqual({
      failedGates: ['typecheck'],
      maxAttempts: 1,
      parentRunId: 'run-abc',
    });
  });

  it('repairIntent.failedGates 가 비어 있으면 repairIntent 를 떨군다', () => {
    const result = normalizeAgentRequest({
      text: 'x',
      repairIntent: { failedGates: [], maxAttempts: 1 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.repairIntent).toBeUndefined();
  });

  it('previousArtifactSource 는 64KB 로 잘라낸다', () => {
    const huge = 'A'.repeat(100 * 1024);
    const result = normalizeAgentRequest({ text: 'x', previousArtifactSource: huge });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.previousArtifactSource?.length).toBe(64 * 1024);
  });

  it('알 수 없는 failedGates 항목은 필터링한다', () => {
    const result = normalizeAgentRequest({
      text: 'x',
      repairIntent: { failedGates: ['typecheck', 'evil-gate', 'axe'], maxAttempts: 1 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.repairIntent?.failedGates).toEqual(['typecheck', 'axe']);
  });
});
