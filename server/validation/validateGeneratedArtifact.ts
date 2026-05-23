import { join } from 'node:path';
import { parseGeneratedArtifact } from '../../src/agent/responseParser.ts';
import { checkTokenUsage } from '../../src/agent/tokenUsage.ts';
import { createTempWorkspace } from './createTempWorkspace.ts';
import { runCommand } from './runCommand.ts';
import type { GeneratedValidationResult, ValidationDetail, ValidationStatus } from './types.ts';
import { writeGeneratedFiles } from './writeGeneratedFiles.ts';

export async function validateGeneratedArtifact(
  markdown: string,
): Promise<GeneratedValidationResult> {
  const startedAt = performance.now();
  const details: ValidationDetail[] = [];
  const artifact = parseGeneratedArtifact(markdown);
  const parsePass = Boolean(artifact.component && artifact.story && artifact.test);
  details.push({
    label: 'Artifact parse',
    status: parsePass ? 'pass' : 'fail',
    message: parsePass
      ? 'component, story, and test artifacts extracted.'
      : 'component, story, and test artifacts are required.',
  });

  const tokenUsage = checkTokenUsage(artifact);
  details.push({
    label: 'Vapor token usage',
    status: tokenUsage.status,
    message:
      tokenUsage.messages.length > 0
        ? tokenUsage.messages.join(' ')
        : 'No raw color, spacing, or radius values detected.',
  });

  if (!parsePass) {
    return finish(startedAt, details, tokenUsage.status);
  }
  const testArtifact = artifact.test;
  if (!testArtifact) {
    return finish(startedAt, details, tokenUsage.status);
  }

  const workspace = await createTempWorkspace();
  try {
    await writeGeneratedFiles(workspace.path, artifact);
    details.push({
      label: 'File write',
      status: 'pass',
      message: 'Generated files written to isolated temp workspace.',
    });

    const typecheck = await runCommand(
      join(workspace.path, 'node_modules/.bin/tsc'),
      ['--noEmit', '-p', 'tsconfig.json'],
      workspace.path,
    );
    details.push({
      label: 'Typecheck',
      status: typecheck.exitCode === 0 ? 'pass' : 'fail',
      message: typecheck.exitCode === 0 ? 'TypeScript completed with error 0.' : 'TypeScript failed.',
      durationMs: typecheck.durationMs,
      output: typecheck.output,
    });

    const unit = await runCommand(
      join(workspace.path, 'node_modules/.bin/vitest'),
      ['run', '--config', 'vitest.config.ts', join('src', testArtifact.filename)],
      workspace.path,
      30_000,
    );
    details.push({
      label: 'Unit',
      status: unit.exitCode === 0 ? 'pass' : 'fail',
      message: unit.exitCode === 0 ? 'Generated unit tests passed.' : 'Generated unit tests failed.',
      durationMs: unit.durationMs,
      output: unit.output,
    });

    const runtimeRender = await runCommand(
      join(workspace.path, 'node_modules/.bin/vitest'),
      ['run', '--config', 'vitest.config.ts', join('src', 'GeneratedRuntimeRender.test.tsx')],
      workspace.path,
      30_000,
    );
    details.push({
      label: 'Runtime Render',
      status: runtimeRender.exitCode === 0 ? 'pass' : 'fail',
      message:
        runtimeRender.exitCode === 0
          ? 'Generated component mounted without runtime console errors.'
          : 'Generated component failed to render or emitted runtime console errors.',
      durationMs: runtimeRender.durationMs,
      output: runtimeRender.output,
    });

    const axe = await runCommand(
      join(workspace.path, 'node_modules/.bin/vitest'),
      ['run', '--config', 'vitest.config.ts', join('src', 'GeneratedRuntimeAxe.test.tsx')],
      workspace.path,
      30_000,
    );
    details.push({
      label: 'Axe',
      status: axe.exitCode === 0 ? 'pass' : 'fail',
      message:
        axe.exitCode === 0
          ? 'Generated runtime axe test reported violations 0.'
          : 'Generated runtime axe test failed.',
      durationMs: axe.durationMs,
      output: axe.output,
    });
  } catch (error) {
    details.push({
      label: 'Validation runner',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown validation failure.',
    });
  } finally {
    await workspace.cleanup();
    details.push({
      label: 'Cleanup',
      status: 'pass',
      message: 'Temp workspace cleanup completed.',
    });
  }

  return finish(startedAt, details, tokenUsage.status);
}

function finish(
  startedAt: number,
  details: ValidationDetail[],
  tokenStatus: ValidationStatus,
): GeneratedValidationResult {
  const hasFailure = details.some((detail) => detail.status === 'fail');
  const hasWarning = tokenStatus === 'warn' || details.some((detail) => detail.status === 'warn');
  return {
    status: hasFailure ? 'fail' : hasWarning ? 'warn' : 'pass',
    durationMs: Math.round(performance.now() - startedAt),
    details,
  };
}
