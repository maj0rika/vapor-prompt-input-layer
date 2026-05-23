import { describe, expect, it } from 'vitest';
import { artifactToMarkdown, parseGeneratedArtifact } from './responseParser';

const RESPONSE = `<artifact-meta>
{
  "componentName": "PrimaryButton",
  "primaryExport": "PrimaryButton",
  "defaultProps": { "children": "Save" },
  "variants": [
    { "name": "Default", "props": { "children": "Save" } },
    { "name": "Disabled", "props": { "children": "Save", "disabled": true } }
  ]
}
</artifact-meta>

<artifact type="component" filename="PrimaryButton.tsx">
\`\`\`tsx
export function PrimaryButton() {
  return <button>Save</button>;
}
\`\`\`
</artifact>

<artifact type="story" filename="PrimaryButton.stories.tsx">
\`\`\`tsx
export const Default = {};
\`\`\`
</artifact>

<artifact type="test" filename="PrimaryButton.test.tsx">
\`\`\`tsx
expect(true).toBe(true);
\`\`\`
</artifact>

<notes type="a11y">
Button has an accessible name.
</notes>

<notes type="token">
Uses Vapor primitives.
</notes>`;

describe('responseParser', () => {
  it('delimiter 기반 artifact 를 타입별로 추출한다', () => {
    const artifact = parseGeneratedArtifact(RESPONSE);

    expect(artifact.metadata?.primaryExport).toBe('PrimaryButton');
    expect(artifact.metadata?.defaultProps?.children).toBe('Save');
    expect(artifact.metadata?.variants).toHaveLength(2);
    expect(artifact.component?.filename).toBe('PrimaryButton.tsx');
    expect(artifact.component?.content).toContain('PrimaryButton');
    expect(artifact.story?.filename).toBe('PrimaryButton.stories.tsx');
    expect(artifact.test?.filename).toBe('PrimaryButton.test.tsx');
    expect(artifact.a11yNotes).toContain('accessible name');
    expect(artifact.tokenNotes).toContain('Vapor primitives');
  });

  it('추출한 artifact 를 preview markdown 으로 정규화한다', () => {
    const markdown = artifactToMarkdown(parseGeneratedArtifact(RESPONSE));

    expect(markdown).toContain('## Component');
    expect(markdown).toContain('## Story');
    expect(markdown).toContain('## Test');
    expect(markdown).toContain('## Validation');
  });

  it('잘못된 응답은 빈 artifact 로 처리한다', () => {
    expect(parseGeneratedArtifact('plain assistant text')).toEqual({});
  });

  it('잘못된 artifact-meta JSON 은 artifact 추출을 깨지 않는다', () => {
    const artifact = parseGeneratedArtifact(
      `<artifact-meta>{bad json}</artifact-meta>\n${RESPONSE}`,
    );

    expect(artifact.metadata).toBeUndefined();
    expect(artifact.component?.filename).toBe('PrimaryButton.tsx');
  });
});
