import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, IconButton, Text } from '@vapor-ui/core';
import { CloseOutlineIcon, CopyOutlineIcon } from '@vapor-ui/icons';
import { parseGeneratedArtifact, type ArtifactProvenance, type GeneratedArtifact } from '../../agent';
import type { MetadataValidationResult } from '../../agent';
import { Markdown } from './Markdown';

type ArtifactTab = 'canvas' | 'component' | 'story' | 'test' | 'validation';

type ArtifactSection = {
  id: ArtifactTab;
  label: string;
  content: string;
};

type CanvasVariant = {
  name: string;
  label: string;
  disabled?: boolean;
};

type CanvasModel = {
  componentName: string;
  variants: CanvasVariant[];
  canRunReactPreview: boolean;
  hasMetadata: boolean;
  metadataValidation: MetadataValidationResult;
};

type CanvasTheme = 'light' | 'dark';
type CanvasPreviewStatus = 'loading' | 'ready' | 'failed';

export type PreviewPanelProps = {
  /** 에이전트가 작성 중/완료한 생성 artifact. 스트리밍 중 점진 갱신된다. */
  draft: string;
  /** 실제 validation runner 에 다시 전달할 delimiter 기반 artifact 원문. */
  artifactSource?: string;
  /** artifact provenance 를 표시해 sample 과 모델 응답을 구분한다. */
  artifactProvenance?: ArtifactProvenance;
  /** 실제 validation runner 상태를 상위 pipeline rail 에 반영한다. */
  onValidationStateChange?: (state: ValidationPipelineState) => void;
  onRepair?: (payload: {
    artifactSource: string;
    validationResult: RemoteValidationResult;
    failedGates: Array<'typecheck' | 'unit' | 'runtime' | 'axe' | 'token' | 'cleanup'>;
  }) => void;
  onClose: () => void;
  canClose?: boolean;
};

export type ValidationPipelineState = 'idle' | 'running' | 'pass' | 'fail' | 'error';

const TAB_LABELS: Record<ArtifactTab, string> = {
  canvas: 'Canvas',
  component: 'Component',
  story: 'Story',
  test: 'Test',
  validation: 'Tests',
};

/**
 * DS 자동화 에이전트가 만든 산출물을 검토하는 artifact workspace.
 *
 * 대화는 의사결정 기록이고, 이 패널은 실제 생성물을 탭 단위로 검토하는 영역이다.
 */
export function PreviewPanel({
  draft,
  artifactSource,
  artifactProvenance,
  onValidationStateChange,
  onRepair,
  onClose,
  canClose = true,
}: PreviewPanelProps) {
  const sections = useMemo(() => parseArtifactSections(draft), [draft]);
  const parsedArtifact = useMemo(
    () => (artifactSource ? parseGeneratedArtifact(artifactSource) : undefined),
    [artifactSource],
  );
  const [validationOverride, setValidationOverride] = useState<string | undefined>();
  const [validationStatus, setValidationStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [validationResult, setValidationResult] = useState<RemoteValidationResult | undefined>();
  const [approved, setApproved] = useState(false);
  const canvas = useMemo(
    () => buildCanvasModel(sections, parsedArtifact),
    [sections, parsedArtifact],
  );
  const [activeTab, setActiveTab] = useState<ArtifactTab>('canvas');
  const [activeVariantName, setActiveVariantName] = useState('Default');
  const [canvasTheme, setCanvasTheme] = useState<CanvasTheme>('light');
  const canvasSection = canvas
    ? {
        id: 'canvas' as const,
        label: 'Canvas',
        content: canvasHtml({
          componentName: canvas.componentName,
          variant:
            canvas.variants.find((variant) => variant.name === activeVariantName) ??
            canvas.variants[0],
          theme: canvasTheme,
        }),
      }
    : undefined;
  const validationSection = validationOverride
    ? { id: 'validation' as const, label: TAB_LABELS.validation, content: validationOverride }
    : undefined;
  const codeSections = validationSection
    ? [
        ...sections.filter((section) => section.id !== 'validation'),
        validationSection,
      ]
    : sections.map((section) =>
        section.id === 'validation' ? { ...section, label: TAB_LABELS.validation } : section,
      );
  const visibleSections = canvasSection ? [canvasSection, ...codeSections] : codeSections;
  const active = visibleSections.find((section) => section.id === activeTab) ?? visibleSections[0];
  const validation = visibleSections.find((section) => section.id === 'validation');

  const handleCopy = () => {
    if (!active) return;
    void navigator.clipboard?.writeText(active.content);
  };
  const handleCopyFailureOutput = () => {
    if (!validationResult) return;
    void navigator.clipboard?.writeText(formatFailureOutput(validationResult));
  };
  const handleRunValidation = () => {
    if (!artifactSource || validationStatus === 'running') return;
    setValidationStatus('running');
    onValidationStateChange?.('running');
    void runValidation(artifactSource)
      .then((result) => {
        setValidationResult(result);
        setValidationOverride(formatValidationResult(result));
        setActiveTab('validation');
        setApproved(false);
        setValidationStatus('idle');
        onValidationStateChange?.(result.status === 'pass' ? 'pass' : 'fail');
      })
      .catch((error) => {
        setValidationResult(undefined);
        setValidationOverride(formatValidationError(error));
        setActiveTab('validation');
        setApproved(false);
        setValidationStatus('error');
        onValidationStateChange?.('error');
      });
  };
  const failedGates = validationResult ? extractFailedGates(validationResult) : [];
  const canApprove = validationResult?.status === 'pass';
  const canRepair = Boolean(artifactSource && validationResult && failedGates.length > 0 && onRepair);
  const isVerifiedSample = artifactProvenance === 'deterministic-sample';
  const showCompactValidationWaiting =
    isVerifiedSample &&
    !validationResult &&
    validationStatus === 'idle' &&
    !validationOverride;

  return (
    <aside
      aria-label="생성물 워크스페이스"
      className="flex min-h-0 flex-col overflow-hidden border-t border-v-normal bg-v-canvas-100 md:border-t-0 md:border-l"
    >
      <header className="flex items-center justify-between border-b border-v-normal px-v-200 py-v-150">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Text typography="subtitle2">Artifact workspace</Text>
          <Text typography="body4" foreground="hint-200">
            generated Vapor component package
          </Text>
        </div>
        <div className="flex items-center gap-1">
          {active && (
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={`${active.label} 복사`}
              onClick={handleCopy}
            >
              <CopyOutlineIcon size={16} />
            </IconButton>
          )}
          {artifactSource && (
            <Button
              size="sm"
              variant="outline"
              colorPalette="primary"
              disabled={validationStatus === 'running'}
              onClick={handleRunValidation}
            >
              {validationStatus === 'running' ? 'Running' : 'Run validation'}
            </Button>
          )}
          {artifactSource && validationResult && (
            <Button
              size="sm"
              variant="outline"
              colorPalette="primary"
              disabled={!canRepair}
              onClick={() =>
                canRepair &&
                onRepair?.({
                  artifactSource,
                  validationResult,
                  failedGates,
                })
              }
            >
              Fix with Agent
            </Button>
          )}
          {validationResult && failedGates.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              colorPalette="danger"
              onClick={handleCopyFailureOutput}
            >
              Copy failing output
            </Button>
          )}
          {artifactSource && (
            <Button
              size="sm"
              variant="outline"
              colorPalette="success"
              disabled={!canApprove}
              onClick={() => setApproved(true)}
            >
              Approve current artifact
            </Button>
          )}
          {canClose && (
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="워크스페이스 닫기"
              onClick={onClose}
            >
              <CloseOutlineIcon size={16} />
            </IconButton>
          )}
        </div>
      </header>

      {isVerifiedSample && (
        <div
          aria-label="Verified sample provenance"
          className="grid gap-v-100 border-b border-v-normal bg-v-primary-100 px-v-200 py-v-150"
        >
          <div className="flex flex-wrap gap-1">
            <Badge size="sm" colorPalette="primary">
              Verified sample run
            </Badge>
            <Badge size="sm" colorPalette="warning">
              Deterministic fixture
            </Badge>
            <Badge size="sm" colorPalette="warning">
              No DeepSeek call
            </Badge>
            <Badge size="sm" colorPalette="success">
              Same parser
            </Badge>
            <Badge size="sm" colorPalette="success">
              Same Canvas runtime
            </Badge>
            <Badge size="sm" colorPalette="success">
              Same validation runner
            </Badge>
          </div>
          <Text typography="body4" foreground="hint-200">
            Validation remains waiting until Run validation returns real
            /api/deepseek/validate output.
          </Text>
        </div>
      )}

      {visibleSections.length > 0 && (
        <div
          role="tablist"
          aria-label="Artifact workspace tabs"
          className="flex flex-wrap gap-1 border-b border-v-normal px-v-200 py-v-150"
        >
          {visibleSections.map((section) => (
            <Button
              key={section.id}
              size="sm"
              variant={section.id === active?.id ? 'outline' : 'ghost'}
              colorPalette="primary"
              role="tab"
              aria-selected={section.id === active?.id ? 'true' : 'false'}
              onClick={() => setActiveTab(section.id)}
            >
              {section.label}
            </Button>
          ))}
        </div>
      )}

      {validation && !showCompactValidationWaiting && (
        <div className="flex flex-wrap gap-1 border-b border-v-normal px-v-200 py-v-150">
          {extractValidationBadges(validation.content).map((item) => (
            <Badge
              key={item.label}
              size="sm"
              colorPalette={
                item.status === 'pass'
                  ? 'success'
                  : item.status === 'fail'
                    ? 'danger'
                    : 'warning'
              }
            >
              {item.label}: {item.status.toUpperCase()}
            </Badge>
          ))}
        </div>
      )}
      {validation && showCompactValidationWaiting && (
        <div className="flex flex-wrap gap-1 border-b border-v-normal px-v-200 py-v-100">
          <Badge size="sm" colorPalette="warning">
            Validation: waiting for runner output
          </Badge>
        </div>
      )}
      {approved && (
        <div className="grid gap-1 border-b border-v-normal px-v-200 py-v-150">
          <Badge size="md" colorPalette="success">
            Artifact marked reviewed
          </Badge>
          <Text typography="body4" foreground="hint-200">
            Local review state only. Does not write files.
          </Text>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-v-300">
        {active?.id === 'canvas' && canvas ? (
          <ArtifactCanvas
            model={canvas}
            artifactSource={artifactSource}
            activeVariantName={activeVariantName}
            onVariantChange={setActiveVariantName}
            theme={canvasTheme}
            onThemeChange={setCanvasTheme}
          />
        ) : active ? (
          <div aria-live="polite">
            <Markdown>{active.content}</Markdown>
          </div>
        ) : (
          <div className="flex h-full flex-col gap-v-300">
            <div className="flex flex-col gap-v-100">
              <Text typography="subtitle2">Workbench readiness</Text>
              <Text typography="body3" foreground="hint-200">
                요청을 실행하면 Canvas preview, generated files, validation gates, repair
                loop가 이곳에서 한 번에 연결됩니다.
              </Text>
            </div>
            <div className="grid gap-v-100 sm:grid-cols-2">
              {[
                ['Canvas waiting', 'No iframe is mounted before artifactSource exists.'],
                ['Artifact parser waiting', 'Component, Story, Test sections will be extracted.'],
                ['Validation gates ready', 'Typecheck, Unit, Runtime, Axe, Token, Cleanup.'],
                ['Repair loop available after failure', 'Failed gate output can be sent back to the agent.'],
              ].map(([title, description]) => (
                <div
                  key={title}
                  className="flex min-h-[96px] flex-col gap-1 rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-200 py-v-150"
                >
                  <Text typography="subtitle2">{title}</Text>
                  <Text typography="body4" foreground="hint-200">
                    {description}
                  </Text>
                </div>
              ))}
            </div>
            <div className="grid gap-v-100">
              <Text typography="subtitle2">Expected outputs</Text>
              <div className="grid gap-v-100 text-sm sm:grid-cols-2">
                {['React + TypeScript', 'Storybook story', 'Vitest test', 'Axe + token check'].map(
                  (item) => (
                    <div
                      key={item}
                      className="rounded-v-200 border border-v-normal px-v-200 py-v-150"
                    >
                      {item}
                    </div>
                  ),
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {['Run validation', 'Fix with Agent', 'Approve current artifact'].map((label) => (
                <Button key={label} size="sm" variant="outline" disabled>
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function ArtifactCanvas({
  model,
  artifactSource,
  activeVariantName,
  onVariantChange,
  theme,
  onThemeChange,
}: {
  model: CanvasModel;
  artifactSource?: string;
  activeVariantName: string;
  onVariantChange: (next: string) => void;
  theme: CanvasTheme;
  onThemeChange: (next: CanvasTheme) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewRunId = useMemo(
    () => createPreviewRunId(activeVariantName, artifactSource, theme),
    [activeVariantName, artifactSource, theme],
  );
  const previewSrc =
    artifactSource && model.canRunReactPreview && model.metadataValidation.status !== 'fail'
      ? `/api/deepseek/preview?artifact=${encodeURIComponent(artifactSource)}&variant=${encodeURIComponent(activeVariantName)}&theme=${theme}&previewRunId=${encodeURIComponent(previewRunId)}`
      : undefined;
  const [previewState, setPreviewState] = useState<{
    src?: string;
    status: CanvasPreviewStatus;
    error?: string;
  }>({ status: 'loading' });
  const previewStatus = previewState.src === previewSrc ? previewState.status : 'loading';
  const previewError = previewState.src === previewSrc ? previewState.error : undefined;

  useEffect(() => {
    if (!previewSrc) return;
    let settled = false;
    let timeoutId = 0;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isPreviewMessage(event.data)) return;
      if (event.data.previewRunId !== previewRunId) return;
      if (event.data.variant !== activeVariantName || event.data.theme !== theme) return;

      if (event.data.type === 'vapor-preview-ready') {
        settled = true;
        window.clearTimeout(timeoutId);
        setPreviewState({ src: previewSrc, status: 'ready' });
      }
      if (event.data.type === 'vapor-preview-error') {
        settled = true;
        window.clearTimeout(timeoutId);
        setPreviewState({
          src: previewSrc,
          status: 'failed',
          error: event.data.message || 'Preview runtime failed.',
        });
      }
    };

    window.addEventListener('message', handleMessage);
    timeoutId = window.setTimeout(() => {
      if (settled) return;
      setPreviewState({
        src: previewSrc,
        status: 'failed',
        error: 'Canvas runtime did not report ready before timeout.',
      });
    }, 5_000);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('message', handleMessage);
    };
  }, [activeVariantName, previewRunId, previewSrc, theme]);

  const handleIframeLoad = () => {
    if (!previewSrc || previewStatus !== 'loading') return;
    const iframeDocument = iframeRef.current?.contentDocument;
    const bodyText = iframeDocument?.body?.innerText.trim();
    const hasPreviewRoot = Boolean(iframeDocument?.getElementById('root'));
    if (bodyText && !hasPreviewRoot) {
      setPreviewState({
        src: previewSrc,
        status: 'failed',
        error: bodyText,
      });
    }
  };

  if (!previewSrc) {
    return (
      <div className="flex h-full min-h-[260px] flex-col gap-v-150">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Text typography="subtitle2">Canvas unavailable</Text>
          <Text typography="body4" foreground="hint-200">
            runtime preview requires a parsed component artifact, source payload, and valid metadata contract
          </Text>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge
            size="sm"
            colorPalette={
              model.metadataValidation.status === 'pass'
                ? 'success'
                : model.metadataValidation.status === 'fail'
                  ? 'danger'
                  : 'warning'
            }
          >
            {model.hasMetadata
              ? `Metadata contract: ${model.metadataValidation.status.toUpperCase()}`
              : 'Heuristic props'}
          </Badge>
        </div>
        <div
          role="status"
          className="rounded-v-300 border border-dashed border-v-normal bg-v-canvas-200 p-v-300"
        >
          <Text typography="body3">
            {model.metadataValidation.status === 'fail'
              ? `Metadata contract failed: ${model.metadataValidation.errors.join(' ')}`
              : '이 artifact는 실제 React preview runtime으로 mount되지 않았습니다. Canvas를 성공 상태로 표시하지 않고 Component/Story/Test 탭에서 원본만 검토합니다.'}
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[360px] flex-col gap-v-200">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Text typography="subtitle2">Canvas</Text>
            <Text typography="body4" foreground="hint-200">
              sandboxed generated component preview
            </Text>
          </div>
        <div className="flex flex-wrap justify-end gap-1">
          <Badge size="sm" colorPalette="primary">
            Canvas preview
          </Badge>
          <Badge
            size="sm"
            colorPalette={
              model.metadataValidation.status === 'pass'
                ? 'success'
                : model.metadataValidation.status === 'fail'
                  ? 'danger'
                  : 'warning'
            }
          >
            {model.hasMetadata
              ? `Metadata contract: ${model.metadataValidation.status.toUpperCase()}`
              : 'Heuristic props'}
          </Badge>
          <Badge
            size="sm"
            aria-label={`Canvas runtime: ${previewStatus}`}
            colorPalette={
              previewStatus === 'ready'
                ? 'success'
                : previewStatus === 'failed'
                  ? 'danger'
                  : 'warning'
            }
          >
            Runtime {previewStatus}
          </Badge>
        </div>
      </div>
      {!model.hasMetadata && (
        <div className="rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-200 py-v-150">
          <Text typography="body4">
            artifact-meta가 없어 Canvas가 component/story 텍스트에서 props를 추정합니다.
          </Text>
        </div>
      )}
      {model.hasMetadata && model.metadataValidation.status !== 'pass' && (
        <div className="rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-200 py-v-150">
          <Text typography="body4">
            {model.metadataValidation.status === 'fail'
              ? 'Metadata contract failed. Canvas mounted state is unavailable until the contract is fixed.'
              : 'Metadata contract warning. Canvas may mount, but the contract needs review.'}
          </Text>
          {model.metadataValidation.messages.map((message) => (
            <Text key={message} typography="body4" foreground="hint-200">
              {message}
            </Text>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1">
        {model.variants.map((variant) => (
          <Button
            key={variant.name}
            size="sm"
            variant={variant.name === activeVariantName ? 'outline' : 'ghost'}
            colorPalette="primary"
            aria-label={`${variant.name} variant`}
            onClick={() => onVariantChange(variant.name)}
          >
            {variant.name}
          </Button>
        ))}
        <div className="mx-v-100 h-v-300 border-l border-v-normal" />
        {(['light', 'dark'] as const).map((nextTheme) => (
          <Button
            key={nextTheme}
            size="sm"
            variant={nextTheme === theme ? 'outline' : 'ghost'}
            colorPalette="primary"
            aria-label={`${capitalize(nextTheme)} theme`}
            onClick={() => onThemeChange(nextTheme)}
          >
            {capitalize(nextTheme)}
          </Button>
        ))}
      </div>
      <iframe
        ref={iframeRef}
        title="Generated artifact canvas"
        sandbox="allow-scripts allow-same-origin"
        src={previewSrc}
        onLoad={handleIframeLoad}
        className="min-h-[180px] flex-1 rounded-v-300 border border-v-normal bg-v-canvas-100"
      />
      {previewStatus === 'failed' && previewError && (
        <div className="rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-200 py-v-150">
          <Text typography="body4">{previewError}</Text>
        </div>
      )}
    </div>
  );
}

function parseArtifactSections(markdown: string): ArtifactSection[] {
  if (!markdown.trim()) return [];

  const matches = [...markdown.matchAll(/^##\s+(Component|Story|Test|Validation)\s*$/gim)];
  if (matches.length === 0) {
    return [{ id: 'component', label: 'Component', content: markdown }];
  }

  return matches.map((match, index) => {
    const title = match[1].toLowerCase() as ArtifactTab;
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    const content = markdown.slice(start, end).trim();
    return {
      id: title,
      label: TAB_LABELS[title],
      content: `## ${TAB_LABELS[title]}\n\n${content}`,
    };
  });
}

function buildCanvasModel(
  sections: ArtifactSection[],
  artifact?: GeneratedArtifact,
): CanvasModel | undefined {
  const component = sections.find((section) => section.id === 'component');
  const story = sections.find((section) => section.id === 'story');
  if (!component) return undefined;

  const metadata = artifact?.metadata;
  const metadataValidation =
    artifact?.metadataValidation ?? {
      status: 'warn' as const,
      messages: ['Heuristic props fallback required.'],
      warnings: ['Heuristic props fallback required.'],
      errors: [],
    };
  const componentName =
    metadata?.componentName ??
    metadata?.primaryExport ??
    component.content.match(/export function\s+(\w+)/)?.[1] ??
    'GeneratedComponent';
  const label =
    story?.content.match(/children:\s*['"]([^'"]+)['"]/)?.[1] ??
    component.content.match(/>\s*([^<>{}\n][^<>{}]*)\s*<\/Button>/)?.[1] ??
    'Generated action';
  const metadataVariants = metadata ? buildMetadataVariants(metadata.defaultProps, metadata.variants) : [];

  return {
    componentName,
    canRunReactPreview: /export function\s+\w+/.test(component.content),
    hasMetadata: Boolean(metadata),
    metadataValidation,
    variants:
      metadataVariants.length > 0
        ? metadataVariants
        : [
            { name: 'Default', label },
            ...(story?.content.includes('Disabled')
              ? [{ name: 'Disabled', label, disabled: true }]
              : []),
          ],
  };
}

function buildMetadataVariants(
  defaultProps: Record<string, unknown> | undefined,
  variants: Array<{ name: string; props?: Record<string, unknown> }> | undefined,
): CanvasVariant[] {
  const sourceVariants =
    variants && variants.length > 0 ? variants : [{ name: 'Default', props: defaultProps ?? {} }];

  return sourceVariants.map((variant) => {
    const props = { ...(defaultProps ?? {}), ...(variant.props ?? {}) };
    const label = typeof props.children === 'string' ? props.children : variant.name;
    return {
      name: variant.name,
      label,
      disabled: props.disabled === true,
    };
  });
}

function canvasHtml({
  componentName,
  variant,
  theme,
}: {
  componentName: string;
  variant: CanvasVariant;
  theme: CanvasTheme;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        --canvas-bg: #f8fafc;
        --surface: #ffffff;
        --border: #d9dee8;
        --primary: #2563eb;
        --primary-hover: #1d4ed8;
        --text: #111827;
        --muted: #64748b;
      }
      body[data-theme="dark"] {
        color-scheme: dark;
        --canvas-bg: #111827;
        --surface: #1f2937;
        --border: #475569;
        --primary: #60a5fa;
        --primary-hover: #93c5fd;
        --text: #f8fafc;
        --muted: #cbd5e1;
      }
      html, body {
        margin: 0;
        min-height: 100%;
        background: var(--canvas-bg);
        color: var(--text);
      }
      body {
        display: grid;
        place-items: center;
        padding: 32px;
        box-sizing: border-box;
      }
      [data-testid="artifact-canvas"] {
        display: grid;
        gap: 14px;
        min-width: min(100%, 320px);
        padding: 28px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--surface);
      }
      .eyebrow {
        margin: 0;
        color: var(--muted);
        font-size: 12px;
      }
      button {
        min-height: 40px;
        border: 0;
        border-radius: 8px;
        padding: 0 16px;
        background: var(--primary);
        color: white;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      button:hover {
        background: var(--primary-hover);
      }
      button:focus-visible {
        outline: 3px solid color-mix(in srgb, var(--primary) 35%, transparent);
        outline-offset: 2px;
      }
    </style>
  </head>
  <body data-theme="${theme}">
    <main data-testid="artifact-canvas" aria-label="${escapeHtml(componentName)} preview">
      <p class="eyebrow">${escapeHtml(componentName)}</p>
      <button type="button"${variant.disabled ? ' disabled' : ''}>${escapeHtml(variant.label)}</button>
    </main>
  </body>
</html>`;
}

function extractValidationBadges(
  content: string,
): Array<{ label: string; status: 'pass' | 'fail' | 'check' }> {
  const labels = ['Typecheck', 'Unit', 'Runtime Render', 'Axe', 'Vapor token usage', 'Cleanup'];
  return labels.map((label) => ({
    label,
    status: readValidationStatus(content, label),
  }));
}

function readValidationStatus(content: string, label: string): 'pass' | 'fail' | 'check' {
  const match = content.match(new RegExp(`${escapeRegExp(label)}\\s*:\\s*(PASS|FAIL|CHECK)`, 'i'));
  const status = match?.[1]?.toLowerCase();
  return status === 'pass' || status === 'fail' ? status : 'check';
}

type RemoteValidationResult = {
  status: 'pass' | 'warn' | 'fail';
  durationMs: number;
  details: Array<{
    label: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
    durationMs?: number;
    output?: string;
  }>;
};

async function runValidation(markdown: string): Promise<RemoteValidationResult> {
  const response = await fetch('/api/deepseek/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown }),
  });
  if (!response.ok) {
    throw new Error(`Validation request failed (${response.status}).`);
  }
  return (await response.json()) as RemoteValidationResult;
}

function formatValidationResult(result: RemoteValidationResult): string {
  const details = new Map(result.details.map((detail) => [detail.label, detail]));
  const labels = ['Typecheck', 'Unit', 'Runtime Render', 'Axe', 'Vapor token usage', 'Cleanup'];
  const outputBlocks = result.details.flatMap((detail) => {
    const output = detail.output?.trim();
    if (!output) return [];
    return [
      '',
      `#### ${detail.label} output`,
      '',
      '```txt',
      trimRunnerOutput(output),
      '```',
    ];
  });
  return [
    '## Tests',
    '',
    ...labels.map((label) => {
      const detail = details.get(label);
      const status =
        detail?.status === 'pass' ? 'PASS' : detail?.status === 'fail' ? 'FAIL' : 'CHECK';
      return `- ${label}: ${status}`;
    }),
    '',
    '### Runner details',
    ...result.details.map((detail) => {
      const duration = detail.durationMs ? ` (${detail.durationMs}ms)` : '';
      return `- ${detail.label}: ${detail.status.toUpperCase()}${duration} - ${detail.message}`;
    }),
    ...outputBlocks,
    `- Duration: ${result.durationMs}ms`,
  ].join('\n');
}

function formatValidationError(error: unknown): string {
  return [
    '## Tests',
    '',
    '- Typecheck: CHECK',
    '- Unit: CHECK',
    '- Runtime Render: CHECK',
    '- Axe: CHECK',
    '- Vapor token usage: CHECK',
    '- Cleanup: CHECK',
    '',
    '### Runner details',
    error instanceof Error ? error.message : 'Validation request failed.',
  ].join('\n');
}

function extractFailedGates(
  result: RemoteValidationResult,
): Array<'typecheck' | 'unit' | 'runtime' | 'axe' | 'token' | 'cleanup'> {
  return result.details.flatMap((detail) => {
    if (detail.status !== 'fail') return [];
    switch (detail.label) {
      case 'Typecheck':
        return ['typecheck'];
      case 'Unit':
        return ['unit'];
      case 'Runtime Render':
        return ['runtime'];
      case 'Axe':
        return ['axe'];
      case 'Vapor token usage':
        return ['token'];
      case 'Cleanup':
        return ['cleanup'];
      default:
        return [];
    }
  });
}

function formatFailureOutput(result: RemoteValidationResult): string {
  const failures = result.details.filter((detail) => detail.status === 'fail');
  if (failures.length === 0) return 'No failing validation output.';
  return failures
    .map((detail) => {
      const output = detail.output?.trim() || detail.message;
      return [`[${detail.label}]`, output].join('\n');
    })
    .join('\n\n');
}

function trimRunnerOutput(output: string): string {
  const maxLength = 6_000;
  return output.length > maxLength
    ? `${output.slice(0, maxLength)}\n... output truncated ...`
    : output;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function createPreviewRunId(
  activeVariantName: string,
  artifactSource: string | undefined,
  theme: CanvasTheme,
): string {
  const scope = `${activeVariantName.length}-${artifactSource?.length ?? 0}-${theme}`;
  const entropy =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${scope}-${entropy}`;
}

function isPreviewMessage(value: unknown): value is {
  type: 'vapor-preview-ready' | 'vapor-preview-error';
  previewRunId: string;
  variant: string;
  theme: CanvasTheme;
  message?: string;
} {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    (record.type === 'vapor-preview-ready' || record.type === 'vapor-preview-error') &&
    typeof record.previewRunId === 'string' &&
    typeof record.variant === 'string' &&
    (record.theme === 'light' || record.theme === 'dark') &&
    (record.message === undefined || typeof record.message === 'string')
  );
}
