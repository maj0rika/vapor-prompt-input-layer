import { validateArtifactMetadata, type MetadataValidationResult } from './artifactMetadata.ts';

export type ArtifactType = 'component' | 'story' | 'test';

export type CodeArtifact = {
  type: ArtifactType;
  filename: string;
  language: 'ts' | 'tsx';
  content: string;
};

export type ArtifactVariantMetadata = {
  name: string;
  props?: Record<string, unknown>;
};

export type ArtifactMetadata = {
  componentName?: string;
  primaryExport?: string;
  defaultProps?: Record<string, unknown>;
  variants?: ArtifactVariantMetadata[];
};

export type GeneratedArtifact = {
  metadata?: ArtifactMetadata;
  metadataValidation?: MetadataValidationResult;
  component?: CodeArtifact;
  story?: CodeArtifact;
  test?: CodeArtifact;
  a11yNotes?: string;
  tokenNotes?: string;
};

const ARTIFACT_RE =
  /<artifact\s+type="(component|story|test)"\s+filename="([^"]+)">\s*```(tsx|ts)?\s*([\s\S]*?)```\s*<\/artifact>/g;
const META_RE = /<artifact-meta>\s*([\s\S]*?)\s*<\/artifact-meta>/;
const NOTES_RE = /<notes\s+type="(a11y|token)">([\s\S]*?)<\/notes>/g;

export function parseGeneratedArtifact(markdown: string): GeneratedArtifact {
  const metadataParse = parseArtifactMetadata(markdown);
  const result: GeneratedArtifact = {
    ...(metadataParse.metadata ? { metadata: metadataParse.metadata } : {}),
    metadataValidation: { status: 'warn', messages: [], warnings: [], errors: [] },
  };
  const metadata = metadataParse.metadata;
  if (metadata) result.metadata = metadata;

  for (const match of markdown.matchAll(ARTIFACT_RE)) {
    const type = match[1] as ArtifactType;
    const artifact: CodeArtifact = {
      type,
      filename: match[2],
      language: (match[3] || inferLanguage(match[2])) as 'ts' | 'tsx',
      content: match[4].trim(),
    };
    result[type] = artifact;
  }

  for (const match of markdown.matchAll(NOTES_RE)) {
    const type = match[1];
    if (type === 'a11y') result.a11yNotes = match[2].trim();
    if (type === 'token') result.tokenNotes = match[2].trim();
  }

  result.metadataValidation = validateArtifactMetadata({
    metadata,
    rawMetadata: metadataParse.rawMetadata,
    parseError: metadataParse.parseError,
    componentSource: result.component?.content,
  });

  return result;
}

export function artifactToMarkdown(artifact: GeneratedArtifact): string {
  const sections: string[] = [];
  if (artifact.component) {
    sections.push(codeSection('Component', artifact.component));
  }
  if (artifact.story) {
    sections.push(codeSection('Story', artifact.story));
  }
  if (artifact.test) {
    sections.push(codeSection('Test', artifact.test));
  }
  if (artifact.a11yNotes || artifact.tokenNotes) {
    sections.push(
      [
        '## Validation',
        '',
        '- Typecheck: CHECK',
        '- Unit: CHECK',
        '- Runtime Render: CHECK',
        '- Axe: CHECK',
        '- Vapor token usage: CHECK',
        '- Cleanup: CHECK',
        artifact.a11yNotes ? `\n### A11y\n${artifact.a11yNotes}` : '',
        artifact.tokenNotes ? `\n### Token\n${artifact.tokenNotes}` : '',
      ].join('\n'),
    );
  }
  return sections.join('\n\n');
}

function parseArtifactMetadata(markdown: string): {
  metadata?: ArtifactMetadata;
  rawMetadata?: string;
  parseError?: string;
} {
  const match = markdown.match(META_RE);
  if (!match) return {};
  const rawMetadata = match[1];

  try {
    const raw = JSON.parse(rawMetadata) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { rawMetadata };
    const value = raw as Record<string, unknown>;
    const metadata: ArtifactMetadata = {};

    if (typeof value.componentName === 'string' && value.componentName.trim()) {
      metadata.componentName = value.componentName.trim();
    }
    if (typeof value.primaryExport === 'string' && value.primaryExport.trim()) {
      metadata.primaryExport = value.primaryExport.trim();
    }
    if (isRecord(value.defaultProps)) {
      metadata.defaultProps = value.defaultProps;
    }
    if (Array.isArray(value.variants)) {
      metadata.variants = value.variants.flatMap((variant) => {
        if (!isRecord(variant) || typeof variant.name !== 'string' || !variant.name.trim()) {
          return [];
        }
        return [
          {
            name: variant.name.trim(),
            ...(isRecord(variant.props) ? { props: variant.props } : {}),
          },
        ];
      });
    }

    return {
      rawMetadata,
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    };
  } catch (error) {
    return {
      rawMetadata,
      parseError: error instanceof Error ? error.message : 'unknown parse error',
    };
  }
}

function codeSection(title: string, artifact: CodeArtifact): string {
  return [
    `## ${title}`,
    '',
    `\`${artifact.filename}\``,
    '',
    `\`\`\`${artifact.language}`,
    artifact.content,
    '```',
  ].join('\n');
}

function inferLanguage(filename: string): 'ts' | 'tsx' {
  return filename.endsWith('.tsx') ? 'tsx' : 'ts';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
