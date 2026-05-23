import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseGeneratedArtifact } from '../../src/agent/responseParser.ts';

const CLEANUP_AFTER_MS = 60_000;

export async function handleArtifactPreview(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    send(res, 405, 'Method not allowed');
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const markdown = url.searchParams.get('artifact') ?? '';
  const variant = url.searchParams.get('variant') ?? 'Default';
  const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light';

  if (!markdown.trim()) {
    send(res, 400, 'Missing artifact source');
    return;
  }

  const artifact = parseGeneratedArtifact(markdown);
  if (!artifact.component) {
    send(res, 422, 'Component artifact is required');
    return;
  }

  const runDir = join(tmpdir(), `vapor-preview-${randomUUID()}`);
  const srcDir = join(runDir, 'src');
  await mkdir(srcDir, { recursive: true });
  await writeFile(join(srcDir, artifact.component.filename), artifact.component.content, 'utf8');

  const entryPath = join(srcDir, 'PreviewEntry.tsx');
  const primaryExport =
    artifact.metadata?.primaryExport ?? inferPrimaryExport(artifact.component.content);
  await writeFile(
    entryPath,
    previewEntry({
      componentFilename: artifact.component.filename,
      primaryExport,
      variant,
      theme,
      previewProps: buildPreviewProps(markdown, artifact, variant),
    }),
    'utf8',
  );

  setTimeout(() => {
    void rm(runDir, { recursive: true, force: true });
  }, CLEANUP_AFTER_MS).unref();

  sendHtml(
    res,
    [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      '</head>',
      `<body data-theme="${theme}">`,
      '<div id="root"></div>',
      '<script type="module">',
      "import RefreshRuntime from '/@react-refresh';",
      'RefreshRuntime.injectIntoGlobalHook(window);',
      'window.$RefreshReg$ = () => {};',
      'window.$RefreshSig$ = () => (type) => type;',
      'window.__vite_plugin_react_preamble_installed__ = true;',
      '</script>',
      `<script type="module" src="/@fs/${entryPath}"></script>`,
      '</body>',
      '</html>',
    ].join('\n'),
  );
}

function previewEntry({
  componentFilename,
  primaryExport,
  variant,
  theme,
  previewProps,
}: {
  componentFilename: string;
  primaryExport: string;
  variant: string;
  theme: 'light' | 'dark';
  previewProps: Record<string, unknown>;
}): string {
  const importPath = `./${componentFilename.replace(/\.tsx?$/, '')}`;
  return [
    "import React from 'react';",
    "import { createRoot } from 'react-dom/client';",
    "import { ThemeProvider } from '@vapor-ui/core';",
    "import '/src/index.css';",
    `import * as ComponentModule from '${importPath}';`,
    '',
    `const Component = ComponentModule[${JSON.stringify(primaryExport)}] ?? Object.values(ComponentModule).find((value) => typeof value === 'function');`,
    "if (!Component) throw new Error('No exported React component found.');",
    `const previewProps = ${JSON.stringify(previewProps)};`,
    `const previewVariant = ${JSON.stringify(variant)};`,
    `const previewTheme = ${JSON.stringify(theme)};`,
    '',
    'function notifyPreview(type: "vapor-preview-ready" | "vapor-preview-error", message?: string) {',
    '  window.parent.postMessage({ type, variant: previewVariant, theme: previewTheme, message }, window.location.origin);',
    '}',
    '',
    'class PreviewErrorBoundary extends React.Component<',
    '  { children: React.ReactNode },',
    '  { error?: Error }',
    '> {',
    '  state: { error?: Error } = {};',
    '  componentDidCatch(error: Error) {',
    '    this.setState({ error });',
    '    notifyPreview("vapor-preview-error", error.message);',
    '  }',
    '  render() {',
    '    if (this.state.error) {',
    '      return <pre data-preview-error>{this.state.error.message}</pre>;',
    '    }',
    '    return this.props.children;',
    '  }',
    '}',
    '',
    'function ReadyReporter() {',
    '  React.useEffect(() => {',
    '    notifyPreview("vapor-preview-ready");',
    '  }, []);',
    '  return null;',
    '}',
    '',
    'function PreviewApp() {',
    '  const element = React.createElement(',
    '    Component as React.ComponentType<Record<string, unknown>>,',
    '    previewProps,',
    '  );',
    '  return (',
    `    <ThemeProvider defaultTheme={${JSON.stringify(theme)}}>`,
    `      <main data-testid="artifact-canvas" aria-label={${JSON.stringify(`${primaryExport} preview`)}} style={{ display: 'grid', placeItems: 'start center', minHeight: '100vh', padding: 24 }}>`,
    '        {element}',
    '      </main>',
    '    </ThemeProvider>',
    '  );',
    '}',
    '',
    "const rootElement = document.getElementById('root')!;",
    "const root = (window as any).__vaporPreviewRoot ?? createRoot(rootElement);",
    "(window as any).__vaporPreviewRoot = root;",
    'root.render(',
    '  <PreviewErrorBoundary>',
    '    <PreviewApp />',
    '    <ReadyReporter />',
    '  </PreviewErrorBoundary>,',
    ');',
    'document.body.dataset.theme = previewTheme;',
    'document.body.dataset.variant = previewVariant;',
    '',
  ].join('\n');
}

function inferPrimaryExport(componentSource: string): string {
  return componentSource.match(/export function\s+(\w+)/)?.[1] ?? 'GeneratedComponent';
}

function inferDefaultLabel(markdown: string): string {
  return markdown.match(/children:\s*['"]([^'"]+)['"]/)?.[1] ?? 'Generated action';
}

function buildPreviewProps(
  markdown: string,
  artifact: ReturnType<typeof parseGeneratedArtifact>,
  variant: string,
): Record<string, unknown> {
  const metadata = artifact.metadata;
  if (metadata) {
    const selectedVariant = metadata.variants?.find((item) => item.name === variant);
    return {
      ...(metadata.defaultProps ?? {}),
      ...(selectedVariant?.props ?? {}),
    };
  }

  return {
    children: inferDefaultLabel(markdown),
    ...(variant === 'Disabled' ? { disabled: true } : {}),
  };
}

function send(res: ServerResponse, status: number, message: string): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(message);
}

function sendHtml(res: ServerResponse, html: string): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}
