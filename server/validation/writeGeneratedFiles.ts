import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { GeneratedArtifact } from '../../src/agent/responseParser.ts';

export async function writeGeneratedFiles(
  workspacePath: string,
  artifact: GeneratedArtifact,
): Promise<void> {
  if (!artifact.component || !artifact.story || !artifact.test) {
    throw new Error('component, story, and test artifacts are required.');
  }
  const srcDir = join(workspacePath, 'src');
  await mkdir(srcDir, { recursive: true });
  await symlink(resolve('node_modules'), join(workspacePath, 'node_modules'), 'dir');
  await writeFile(join(workspacePath, 'package.json'), packageJson(), 'utf8');
  await writeFile(join(workspacePath, 'tsconfig.json'), tsconfigJson(), 'utf8');
  await writeFile(join(workspacePath, 'vitest.config.ts'), vitestConfig(), 'utf8');
  await writeFile(join(srcDir, 'storybook-react.d.ts'), storybookTypes(), 'utf8');
  await writeFile(join(srcDir, artifact.component.filename), artifact.component.content, 'utf8');
  await writeFile(join(srcDir, artifact.story.filename), artifact.story.content, 'utf8');
  await writeFile(join(srcDir, artifact.test.filename), artifact.test.content, 'utf8');
  await writeFile(
    join(srcDir, 'GeneratedRuntimeRender.test.tsx'),
    runtimeRenderTest(
      artifact.component.filename,
      resolvePrimaryExportMode(artifact),
      buildRuntimeCases(artifact),
    ),
    'utf8',
  );
  await writeFile(
    join(srcDir, 'GeneratedRuntimeAxe.test.tsx'),
    axeTest(
      artifact.component.filename,
      resolvePrimaryExportMode(artifact),
      buildRuntimeCases(artifact),
    ),
    'utf8',
  );
}

function packageJson(): string {
  return `${JSON.stringify({ type: 'module', private: true }, null, 2)}\n`;
}

function tsconfigJson(): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        types: ['node', 'vitest/globals', '@testing-library/jest-dom'],
      },
      include: ['src/**/*.ts', 'src/**/*.tsx'],
    },
    null,
    2,
  )}\n`;
}

function vitestConfig(): string {
  return [
    "import { defineConfig } from 'vitest/config';",
    '',
    'export default defineConfig({',
    "  test: { environment: 'jsdom' },",
    '});',
    '',
  ].join('\n');
}

function storybookTypes(): string {
  return [
    "declare module '@storybook/react' {",
    '  export type Meta<T = unknown> = Record<string, unknown> & { component?: T };',
    '  export type StoryObj<T = unknown> = Record<string, unknown> & { args?: Record<string, unknown> };',
    '}',
    '',
  ].join('\n');
}

function runtimeRenderTest(
  componentFilename: string,
  exportMode: ComponentExportMode,
  runtimeCases: RuntimeCase[],
): string {
  const importPath = `./${componentFilename.replace(/\.tsx?$/, '')}`;
  const componentLookup = componentLookupExpression(exportMode);
  return [
    "import React from 'react';",
    "import { render } from '@testing-library/react';",
    "import { afterEach, beforeEach, expect, it, vi } from 'vitest';",
    `import * as ComponentModule from '${importPath}';`,
    '',
    'let consoleErrorSpy: ReturnType<typeof vi.spyOn>;',
    '',
    'beforeEach(() => {',
    "  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});",
    '});',
    '',
    'afterEach(() => {',
    '  consoleErrorSpy.mockRestore();',
    '});',
    '',
    `const runtimeCases = ${JSON.stringify(runtimeCases)};`,
    '',
    "it.each(runtimeCases)('mounts $name without runtime console errors', ({ props }) => {",
    `  const maybeComponent = ${componentLookup};`,
    "  if (!maybeComponent) throw new Error('No exported React component found.');",
    '  const Component = maybeComponent as React.ComponentType<Record<string, unknown>>;',
    '  render(React.createElement(Component, props));',
    '  expect(consoleErrorSpy).not.toHaveBeenCalled();',
    '});',
    '',
  ].join('\n');
}

function axeTest(
  componentFilename: string,
  exportMode: ComponentExportMode,
  runtimeCases: RuntimeCase[],
): string {
  const importPath = `./${componentFilename.replace(/\.tsx?$/, '')}`;
  const componentLookup = componentLookupExpression(exportMode);
  return [
    "import React from 'react';",
    "import { render } from '@testing-library/react';",
    "import { axe } from 'jest-axe';",
    "import { expect, it } from 'vitest';",
    `import * as ComponentModule from '${importPath}';`,
    '',
    `const runtimeCases = ${JSON.stringify(runtimeCases)};`,
    '',
    "it.each(runtimeCases)('renders $name without axe violations', async ({ props }) => {",
    `  const maybeComponent = ${componentLookup};`,
    "  if (!maybeComponent) throw new Error('No exported React component found.');",
    '  const Component = maybeComponent as React.ComponentType<Record<string, unknown>>;',
    '  const { container } = render(React.createElement(Component, props));',
    '  const result = await axe(container);',
    '  expect(result.violations).toHaveLength(0);',
    '});',
    '',
  ].join('\n');
}

type RuntimeCase = {
  name: string;
  props: Record<string, unknown>;
};

function buildRuntimeCases(artifact: GeneratedArtifact): RuntimeCase[] {
  const metadata = artifact.metadata;
  if (!metadata) return [{ name: 'Heuristic', props: { children: 'Generated action' } }];
  const variants =
    metadata.variants && metadata.variants.length > 0
      ? metadata.variants
      : [{ name: 'Default', props: {} }];
  return variants.map((variant) => ({
    name: variant.name,
    props: {
      ...(metadata.defaultProps ?? {}),
      ...(variant.props ?? {}),
    },
  }));
}

type ComponentExportMode =
  | { kind: 'strict'; primaryExport: string }
  | { kind: 'fallback' };

function resolvePrimaryExportMode(artifact: GeneratedArtifact): ComponentExportMode {
  if (artifact.metadata) {
    if (!artifact.metadata.primaryExport) {
      throw new Error('Metadata contract failed: primaryExport is required.');
    }
    return { kind: 'strict', primaryExport: artifact.metadata.primaryExport };
  }
  return { kind: 'fallback' };
}

function componentLookupExpression(exportMode: ComponentExportMode): string {
  const fallback = "Object.values(ComponentModule).find((value) => typeof value === 'function')";
  return exportMode.kind === 'strict'
    ? `ComponentModule[${JSON.stringify(exportMode.primaryExport)}]`
    : fallback;
}
