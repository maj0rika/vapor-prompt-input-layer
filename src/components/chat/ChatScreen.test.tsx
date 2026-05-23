import { describe, expect, it } from 'vitest';
import { deriveRunPipelineSteps } from './runPipeline';

function statusMap(
  steps: ReturnType<typeof deriveRunPipelineSteps>,
): Record<string, string> {
  return Object.fromEntries(steps.map((step) => [step.label, step.status]));
}

describe('deriveRunPipelineSteps', () => {
  it('keeps validation waiting before the real runner returns', () => {
    const steps = statusMap(
      deriveRunPipelineSteps({
        hasPrompt: true,
        hasDraft: true,
        hasArtifactSource: true,
        validationState: 'idle',
      }),
    );

    expect(steps.Prompt).toBe('pass');
    expect(steps.Artifact).toBe('pass');
    expect(steps.Canvas).toBe('pass');
    expect(steps.Validation).toBe('waiting');
  });

  it('maps actual validation runner states to rail states', () => {
    expect(
      statusMap(
        deriveRunPipelineSteps({
          hasPrompt: true,
          hasDraft: true,
          hasArtifactSource: true,
          validationState: 'running',
        }),
      ).Validation,
    ).toBe('active');
    expect(
      statusMap(
        deriveRunPipelineSteps({
          hasPrompt: true,
          hasDraft: true,
          hasArtifactSource: true,
          validationState: 'pass',
        }),
      ).Validation,
    ).toBe('pass');
    expect(
      statusMap(
        deriveRunPipelineSteps({
          hasPrompt: true,
          hasDraft: true,
          hasArtifactSource: true,
          validationState: 'fail',
        }),
      ).Validation,
    ).toBe('fail');
    expect(
      statusMap(
        deriveRunPipelineSteps({
          hasPrompt: true,
          hasDraft: true,
          hasArtifactSource: true,
          validationState: 'error',
        }),
      ).Validation,
    ).toBe('fail');
  });
});
