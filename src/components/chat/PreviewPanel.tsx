import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, IconButton, Text } from '@vapor-ui/core';
import { CloseOutlineIcon, CopyOutlineIcon } from '@vapor-ui/icons';
import { parseGeneratedArtifact, type AgentMode, type ArtifactProvenance, type GeneratedArtifact } from '../../agent';
import type { MetadataValidationResult } from '../../agent';
import { Markdown } from './Markdown';
import { ValidationPanel, type RemoteValidationResult } from './ValidationPanel';

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
type CanvasPreviewStatus = 'loading' | 'ready' | 'failed' | 'timeout';

export type PreviewPanelProps = {
  /** 에이전트가 작성 중/완료한 생성 artifact. 스트리밍 중 점진 갱신된다. */
  draft: string;
  /** 실제 validation runner 에 다시 전달할 delimiter 기반 artifact 원문. */
  artifactSource?: string;
  /** artifact provenance 를 표시해 sample 과 모델 응답을 구분한다. */
  artifactProvenance?: ArtifactProvenance;
  /** 현재 agent mode. token-sync 는 Canvas 를 마운트하지 않는다. */
  artifactMode?: AgentMode;
  /** 실제 validation runner 상태를 상위 pipeline rail 에 반영한다. */
  onValidationStateChange?: (state: ValidationPipelineState) => void;
  onRepair?: (payload: {
    artifactSource: string;
    validationResult: RemoteValidationResult;
    failedGates: Array<'typecheck' | 'unit' | 'runtime' | 'axe' | 'token' | 'cleanup'>;
  }) => void;
  /** 현재 artifactRun 의 로컬 승인 상태 변화를 상위로 전달한다. */
  onApprovalChange?: (approved: boolean) => void;
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
  artifactMode,
  onValidationStateChange,
  onRepair,
  onApprovalChange,
  onClose,
  canClose = true,
}: PreviewPanelProps) {
  const isTokenSync = artifactMode === 'token-sync';
  const sections = useMemo(() => parseArtifactSections(draft), [draft]);
  const parsedArtifact = useMemo(
    () => (artifactSource ? parseGeneratedArtifact(artifactSource) : undefined),
    [artifactSource],
  );
  const [validationStatus, setValidationStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [validationResult, setValidationResult] = useState<RemoteValidationResult | undefined>();
  const [validationRunAt, setValidationRunAt] = useState<number | undefined>();
  const [validationErrorMessage, setValidationErrorMessage] = useState<string | undefined>();
  const [approved, setApproved] = useState(false);
  const canvas = useMemo(
    () => buildCanvasModel(sections, parsedArtifact),
    [sections, parsedArtifact],
  );
  const [activeTab, setActiveTab] = useState<ArtifactTab>('canvas');
  const [activeVariantName, setActiveVariantName] = useState('Default');
  const [canvasTheme, setCanvasTheme] = useState<CanvasTheme>('light');
  const canvasSection = canvas && !isTokenSync
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
  const codeSections = sections.map((section) =>
    section.id === 'validation' ? { ...section, label: TAB_LABELS.validation } : section,
  );
  // validation 탭: artifact에 ## Validation 섹션이 없어도 결과가 있으면 탭을 추가한다.
  const hasValidationSection = codeSections.some((s) => s.id === 'validation');
  const validationTabSection =
    !hasValidationSection && (validationResult || validationStatus !== 'idle')
      ? { id: 'validation' as const, label: TAB_LABELS.validation, content: '' }
      : undefined;
  const allCodeSections = validationTabSection
    ? [...codeSections, validationTabSection]
    : codeSections;
  const visibleSections = canvasSection ? [canvasSection, ...allCodeSections] : allCodeSections;
  const active = visibleSections.find((section) => section.id === activeTab) ?? visibleSections[0];

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
        setValidationRunAt(Date.now());
        setActiveTab('validation');
        setApproved(false);
        setValidationStatus('idle');
        onValidationStateChange?.(result.status === 'pass' ? 'pass' : 'fail');
      })
      .catch((error: unknown) => {
        setValidationResult(undefined);
        setValidationRunAt(Date.now());
        setActiveTab('validation');
        setApproved(false);
        setValidationStatus('error');
        setValidationErrorMessage(
          error instanceof Error ? error.message : 'Validation request failed.',
        );
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
    validationStatus === 'idle';

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
              aria-label="현재 artifact 로컬 승인"
              disabled={!canApprove}
              onClick={() => {
                setApproved(true);
                onApprovalChange?.(true);
              }}
            >
              로컬 승인
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

      {!showCompactValidationWaiting && (() => {
        if (validationResult) {
          return (
            <div className="flex flex-wrap gap-1 border-b border-v-normal px-v-200 py-v-150">
              {validationResult.details.map((detail) => (
                <Badge
                  key={detail.label}
                  size="sm"
                  colorPalette={
                    detail.status === 'pass'
                      ? 'success'
                      : detail.status === 'fail'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {detail.label}: {detail.status.toUpperCase()}
                </Badge>
              ))}
            </div>
          );
        }
        const artifactValidationSection = codeSections.find((s) => s.id === 'validation');
        if (artifactValidationSection) {
          const badges = extractValidationBadges(artifactValidationSection.content);
          return (
            <div className="flex flex-wrap gap-1 border-b border-v-normal px-v-200 py-v-150">
              {badges.map((item) => (
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
          );
        }
        return null;
      })()}
      {showCompactValidationWaiting && (
        <div className="flex flex-wrap gap-1 border-b border-v-normal px-v-200 py-v-100">
          <Badge size="sm" colorPalette="warning">
            Validation: waiting for runner output
          </Badge>
        </div>
      )}
      {approved && (
        <div className="grid gap-1 border-b border-v-normal px-v-200 py-v-150">
          <Badge size="md" colorPalette="success">
            로컬 리뷰 승인 완료
          </Badge>
          <Text typography="body4" foreground="hint-200">
            로컬 리뷰 승인만 기록되었습니다. 저장소 변경이나 PR은 생성되지 않습니다.
          </Text>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-v-300">
        {active?.id === 'canvas' && canvas && !isTokenSync ? (
          <ArtifactCanvas
            model={canvas}
            artifactSource={artifactSource}
            activeVariantName={activeVariantName}
            onVariantChange={setActiveVariantName}
            theme={canvasTheme}
            onThemeChange={setCanvasTheme}
          />
        ) : active?.id === 'validation' ? (
          <ValidationPanel
            result={validationResult}
            status={validationStatus}
            errorMessage={validationErrorMessage}
            runAt={validationRunAt}
            onCopyOutput={(label) => {
              const detail = validationResult?.details.find((d) => d.label === label);
              if (detail?.output) void navigator.clipboard?.writeText(detail.output);
            }}
            onRepairGate={onRepair && artifactSource && validationResult
              ? (gate) => {
                  const gateKey = labelToGateKey(gate);
                  if (gateKey) {
                    onRepair({
                      artifactSource,
                      validationResult,
                      failedGates: [gateKey],
                    });
                  }
                }
              : undefined
            }
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
              {['Run validation', 'Fix with Agent', '로컬 승인'].map((label) => (
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
  const parentOrigin = window.location.origin;
  const previewOrigin = useMemo(() => createIsolatedPreviewOrigin(parentOrigin), [parentOrigin]);
  const previewSrc =
    artifactSource && model.canRunReactPreview && model.metadataValidation.status !== 'fail'
      ? `${previewOrigin}/api/deepseek/preview?artifact=${encodeURIComponent(artifactSource)}&variant=${encodeURIComponent(activeVariantName)}&theme=${theme}&previewRunId=${encodeURIComponent(previewRunId)}&parentOrigin=${encodeURIComponent(parentOrigin)}`
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
    const abortController = new AbortController();

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== previewOrigin) return;
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
    void fetch(previewSrc, { signal: abortController.signal })
      .then(async (response) => {
        if (response.ok || settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        const message = await response.text();
        setPreviewState({
          src: previewSrc,
          status: 'failed',
          error: `Preview endpoint failed (${response.status}): ${message}`,
        });
      })
      .catch((error: unknown) => {
        if (settled || abortController.signal.aborted) return;
        settled = true;
        window.clearTimeout(timeoutId);
        setPreviewState({
          src: previewSrc,
          status: 'failed',
          error:
            error instanceof Error
              ? `Preview endpoint failed: ${error.message}`
              : 'Preview endpoint failed.',
        });
      });
    timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      setPreviewState({
        src: previewSrc,
        status: 'timeout',
        error: 'Canvas runtime이 제한 시간 내에 준비 상태를 보고하지 않았습니다.',
      });
    }, 8_000);
    return () => {
      abortController.abort();
      window.clearTimeout(timeoutId);
      window.removeEventListener('message', handleMessage);
    };
  }, [activeVariantName, previewOrigin, previewRunId, previewSrc, theme]);

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
                  : previewStatus === 'timeout'
                    ? 'warning'
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
        className="min-h-[180px] flex-1 rounded-v-300 border border-v-normal bg-v-canvas-100"
      />
      {previewStatus === 'failed' && previewError && (
        <div className="rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-200 py-v-150">
          <Text typography="body4">{previewError}</Text>
        </div>
      )}
      {previewStatus === 'timeout' && (
        <div className="rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-200 py-v-150">
          <Text typography="body4">
            Canvas runtime이 응답하지 않습니다. 페이지를 새로고침하거나 잠시 후 다시 시도해 주세요.
          </Text>
          {previewError && (
            <Text typography="body4" foreground="hint-200">
              {previewError}
            </Text>
          )}
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
  const exportNames = extractComponentExportNames(component.content);
  const componentName =
    metadata?.componentName ??
    metadata?.primaryExport ??
    exportNames.values().next().value ??
    'GeneratedComponent';
  const label =
    story?.content.match(/children:\s*['"]([^'"]+)['"]/)?.[1] ??
    component.content.match(/>\s*([^<>{}\n][^<>{}]*)\s*<\/Button>/)?.[1] ??
    'Generated action';
  const metadataVariants = metadata ? buildMetadataVariants(metadata.defaultProps, metadata.variants) : [];

  return {
    componentName,
    canRunReactPreview: exportNames.size > 0,
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

function extractComponentExportNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/export\s+(?:function|const|class)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s*\{\s*([^}]+)\s*\}/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  if (/export\s+default\s+(?:function|class|\()/g.test(source)) {
    names.add('default');
  }
  return names;
}

function createIsolatedPreviewOrigin(parentOrigin: string): string {
  const url = new URL(parentOrigin);
  if (url.hostname === '127.0.0.1') {
    url.hostname = 'localhost';
    return url.origin;
  }
  if (url.hostname === 'localhost') {
    url.hostname = '127.0.0.1';
    return url.origin;
  }
  return parentOrigin;
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

function labelToGateKey(
  label: string,
): 'typecheck' | 'unit' | 'runtime' | 'axe' | 'token' | 'cleanup' | undefined {
  switch (label) {
    case 'Typecheck': return 'typecheck';
    case 'Unit': return 'unit';
    case 'Runtime Render': return 'runtime';
    case 'Axe': return 'axe';
    case 'Vapor token usage': return 'token';
    case 'Cleanup': return 'cleanup';
    default: return undefined;
  }
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
