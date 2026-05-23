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
    runtimeRenderTest(artifact.component.filename),
    'utf8',
  );
  await writeFile(join(srcDir, 'GeneratedRuntimeAxe.test.tsx'), axeTest(artifact.component.filename), 'utf8');
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

function runtimeRenderTest(componentFilename: string): string {
  const importPath = `./${componentFilename.replace(/\.tsx?$/, '')}`;
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
    "it('mounts the generated component without runtime console errors', () => {",
    '  const maybeComponent = Object.values(ComponentModule).find(',
    "    (value) => typeof value === 'function',",
    '  );',
    "  if (!maybeComponent) throw new Error('No exported React component found.');",
    '  const Component = maybeComponent as React.ComponentType<{ children?: React.ReactNode }>;',
    '  render(<Component>Generated action</Component>);',
    '  expect(consoleErrorSpy).not.toHaveBeenCalled();',
    '});',
    '',
  ].join('\n');
}

function axeTest(componentFilename: string): string {
  const importPath = `./${componentFilename.replace(/\.tsx?$/, '')}`;
  return [
    "import React from 'react';",
    "import { render } from '@testing-library/react';",
    "import { axe } from 'jest-axe';",
    "import { expect, it } from 'vitest';",
    `import * as ComponentModule from '${importPath}';`,
    '',
    "it('renders without axe violations', async () => {",
    '  const maybeComponent = Object.values(ComponentModule).find(',
    "    (value) => typeof value === 'function',",
    '  );',
    "  if (!maybeComponent) throw new Error('No exported React component found.');",
    '  const Component = maybeComponent as React.ComponentType<{ children?: React.ReactNode }>;',
    "  const { container } = render(<Component>Generated action</Component>);",
    '  const result = await axe(container);',
    '  expect(result.violations).toHaveLength(0);',
    '});',
    '',
  ].join('\n');
}
