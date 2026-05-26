import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, IconButton, Text } from '@vapor-ui/core';
import { CloseOutlineIcon, CopyOutlineIcon } from '@vapor-ui/icons';
import { parseGeneratedArtifact, type AgentMode, type ArtifactProvenance, type GeneratedArtifact } from '../../agent';
import type { AgentDebugTrace, MetadataValidationResult } from '../../agent';
import { Markdown } from './Markdown';
// G013.1/G015: 두 패널 모두 token-sync / metadata 탭이 활성일 때만 필요하므로
// React.lazy 로 분리해 초기 JS bundle 예산 (200KB gzip) 을 보호한다.
const MetadataPanel = lazy(() =>
  import('./MetadataPanel').then((m) => ({ default: m.MetadataPanel })),
);
const TokenSyncPanel = lazy(() =>
  import('./TokenSyncPanel').then((m) => ({ default: m.TokenSyncPanel })),
);
// G034: ValidationPanel 도 동일하게 분리해 초기 JS bundle 예산 헤드룸 확보.
const ValidationPanel = lazy(() =>
  import('./ValidationPanel').then((m) => ({ default: m.ValidationPanel })),
);
import type { RemoteValidationResult } from './ValidationPanel';

type ArtifactTab =
  | 'canvas'
  | 'metadata'
  | 'token-mapping'
  | 'component'
  | 'story'
  | 'test'
  | 'validation'
  | 'debug';

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
  /**
   * 현 repair chain 에서 사용자가 누른 "실패 수정" 또는 gate 수정 클릭 수.
   * 한도 도달 시 repair 버튼이 disabled 되며, 사용자에게 한도 초과 안내가
   * 노출된다.
   */
  repairChainAttempts?: number;
  /** 한 chain 안에서 허용되는 최대 repair 시도 수. */
  maxRepairAttemptsPerChain?: number;
  /** 현재 artifactRun 의 로컬 승인 상태 변화를 상위로 전달한다. */
  onApprovalChange?: (approved: boolean) => void;
  /**
   * agent client (DeepSeek/Mock) 가 emit 한 디버그 trace.
   * 존재 시 "디버그" 탭이 노출되어 raw request/response 를 검토할 수 있다.
   */
  debugTrace?: AgentDebugTrace;
  onClose: () => void;
  canClose?: boolean;
};

export type ValidationPipelineState = 'idle' | 'running' | 'pass' | 'fail' | 'error';

const TAB_LABELS: Record<ArtifactTab, string> = {
  canvas: '미리보기',
  metadata: '메타데이터',
  'token-mapping': '토큰 매핑',
  component: '코드',
  story: '스토리',
  test: '테스트',
  validation: '검증',
  debug: '디버그',
};

const GATE_LABELS: Record<string, string> = {
  'Artifact parse': '산출물 파싱',
  'Metadata contract': '메타데이터 계약',
  'Vapor token usage': 'Vapor 토큰',
  'File write': '파일 생성',
  Typecheck: '타입 검사',
  Unit: '단위 테스트',
  'Runtime Render': '런타임 렌더',
  Axe: '접근성',
  Cleanup: '정리',
};

function gateLabel(label: string): string {
  return GATE_LABELS[label] ?? label;
}

function statusLabel(status: 'pass' | 'warn' | 'fail' | 'check'): string {
  if (status === 'pass') return '통과';
  if (status === 'fail') return '실패';
  if (status === 'check') return '대기';
  return '확인 필요';
}

function previewStatusLabel(status: CanvasPreviewStatus): string {
  if (status === 'ready') return '준비됨';
  if (status === 'failed') return '실패';
  if (status === 'timeout') return '지연';
  return '로딩';
}

function variantDisplayName(name: string): string {
  if (name.toLowerCase() === 'default') return '기본';
  if (name.toLowerCase() === 'disabled') return '비활성';
  if (name.toLowerCase() === 'loading') return '로딩';
  if (name.toLowerCase() === 'error') return '오류';
  return name;
}

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
  repairChainAttempts = 0,
  maxRepairAttemptsPerChain = Number.POSITIVE_INFINITY,
  onApprovalChange,
  debugTrace,
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
        label: TAB_LABELS.canvas,
        // Canvas 탭의 "Copy" 가 가져갈 텍스트. raw HTML/CSS 대신 Vapor 토큰
        // 친화적인 상태 요약을 제공한다 — 실제 시각 preview 는 별도 iframe
        // (ArtifactCanvas) 가 렌더하므로 이 content 는 사용자가 외부에 공유
        // 할 때만 쓰인다.
        content: canvasStateSummary({
          componentName: canvas.componentName,
          variant:
            canvas.variants.find((variant) => variant.name === activeVariantName) ??
            canvas.variants[0],
          theme: canvasTheme,
        }),
      }
    : undefined;
  const codeSections = sections
    .filter((section) => section.id !== 'validation')
    .map((section) => ({ ...section, label: TAB_LABELS[section.id] ?? section.label }));
  // validation 탭: runner 가 실제로 실행 중이거나 결과가 있을 때만 노출한다.
  const hasValidationSection = codeSections.some((s) => s.id === 'validation');
  const validationTabSection =
    !hasValidationSection && (validationResult || validationStatus !== 'idle')
      ? { id: 'validation' as const, label: TAB_LABELS.validation, content: '' }
      : undefined;
  const allCodeSections = validationTabSection
    ? [...codeSections, validationTabSection]
    : codeSections;
  // G015: artifact-meta 가 있으면 read-only 메타데이터 탭 노출
  const metadataSection = parsedArtifact?.metadata
    ? { id: 'metadata' as const, label: TAB_LABELS.metadata, content: '' }
    : undefined;
  // G013.1: token-sync mode 에서 TokenSyncPanel (Figma → Vapor mapping table) 탭 노출
  const tokenMappingSection = isTokenSync
    ? { id: 'token-mapping' as const, label: TAB_LABELS['token-mapping'], content: '' }
    : undefined;
  // 디버그 탭: agent client 가 trace 를 채워 보낼 때만 노출. content 는
  // 탭패널이 직접 렌더하므로 빈 문자열.
  const debugSection = debugTrace
    ? { id: 'debug' as const, label: TAB_LABELS.debug, content: '' }
    : undefined;
  const visibleSections = [
    ...(canvasSection ? [canvasSection] : []),
    ...(tokenMappingSection ? [tokenMappingSection] : []),
    ...(metadataSection ? [metadataSection] : []),
    ...allCodeSections,
    ...(debugSection ? [debugSection] : []),
  ];
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
    setApproved(false);
    onApprovalChange?.(false);
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
  const repairChainExhausted = repairChainAttempts >= maxRepairAttemptsPerChain;
  const hasFailedGates = Boolean(
    artifactSource && validationResult && failedGates.length > 0 && onRepair,
  );
  const canRepair = hasFailedGates && !repairChainExhausted;
  const isVerifiedSample = artifactProvenance === 'deterministic-sample';
  const showCompactValidationWaiting =
    isVerifiedSample &&
    !validationResult &&
    validationStatus === 'idle';

  return (
    <aside
      aria-label="생성물 워크스페이스"
      className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-v-normal bg-v-canvas-100 md:h-full md:border-t-0 md:border-l"
    >
      <header className="flex flex-wrap items-center justify-between gap-v-100 border-b border-v-normal px-v-200 py-v-150">
        <div className="flex min-w-0 shrink-0 flex-col gap-v-25">
          <Text
            typography="subtitle2"
            className="whitespace-nowrap"
          >
            산출물 워크스페이스
          </Text>
          <Text
            typography="body4"
            foreground="hint-200"
            className="whitespace-nowrap"
          >
            생성된 Vapor 컴포넌트 패키지
          </Text>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-v-75">
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
              colorPalette="primary"
              title="생성물이 실제로 빌드되고 테스트되는지 확인합니다."
              disabled={validationStatus === 'running'}
              data-testid="workspace-action-validate"
              onClick={handleRunValidation}
            >
              {validationStatus === 'running' ? '검증 중' : '검증 실행'}
            </Button>
          )}
          {artifactSource && validationResult && hasFailedGates && (
            <Button
              size="sm"
              variant="outline"
              colorPalette="danger"
              disabled={!canRepair}
              title={
                repairChainExhausted
                  ? `최대 수정 횟수 초과 (${repairChainAttempts}/${maxRepairAttemptsPerChain}). 새 요청으로 다시 시도하세요.`
                  : `실패한 검증 항목을 다시 생성합니다. 남은 수정 ${Math.max(
                      0,
                      maxRepairAttemptsPerChain - repairChainAttempts,
                    )}회`
              }
              data-testid="workspace-action-repair"
              onClick={() =>
                canRepair &&
                onRepair?.({
                  artifactSource,
                  validationResult,
                  failedGates,
                })
              }
            >
              실패 수정
            </Button>
          )}
          {validationResult && failedGates.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              colorPalette="danger"
              data-testid="workspace-action-copy-failure"
              onClick={handleCopyFailureOutput}
            >
              실패 로그 복사
            </Button>
          )}
          {canApprove && !approved && (
            <Button
              size="sm"
              colorPalette="success"
              title="검증을 통과한 생성물을 로컬 리뷰에서 승인합니다."
              data-testid="workspace-action-approve"
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
          aria-label="검증 샘플 출처"
          className="grid gap-v-100 border-b border-v-normal bg-v-primary-100 px-v-200 py-v-150"
        >
          <div className="flex flex-wrap gap-v-50">
            <Badge size="sm" colorPalette="primary">
              검증된 샘플 실행
            </Badge>
            <Badge size="sm" colorPalette="primary">
              고정 샘플
            </Badge>
            <Badge size="sm" colorPalette="primary">
              API 호출 없음
            </Badge>
            <Badge size="sm" colorPalette="success">
              동일 파서
            </Badge>
            <Badge size="sm" colorPalette="success">
              동일 Canvas 런타임
            </Badge>
            <Badge size="sm" colorPalette="success">
              동일 검증 러너
            </Badge>
          </div>
          <Text typography="body4" foreground="hint-200">
            이 샘플은 화면 확인용 고정 데이터입니다. 실제 검증 결과는 "검증 실행" 후 반영됩니다.
          </Text>
        </div>
      )}

      {visibleSections.length > 0 && (
        <div
          role="tablist"
          aria-label="산출물 워크스페이스 탭"
          className="flex flex-wrap gap-v-50 border-b border-v-normal px-v-200 py-v-150"
        >
          {visibleSections.map((section) => (
            <Button
              key={section.id}
              size="sm"
              variant={section.id === active?.id ? 'outline' : 'ghost'}
              colorPalette="primary"
              role="tab"
              id={`artifact-tab-${section.id}`}
              aria-selected={section.id === active?.id ? 'true' : 'false'}
              aria-controls={`artifact-tabpanel-${section.id}`}
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
            <div className="flex flex-wrap gap-v-50 border-b border-v-normal px-v-200 py-v-150">
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
                  {gateLabel(detail.label)}: {statusLabel(detail.status)}
                </Badge>
              ))}
            </div>
          );
        }
        return null;
      })()}
      {showCompactValidationWaiting && (
        <div className="flex flex-wrap gap-v-50 border-b border-v-normal px-v-200 py-v-100">
          <Badge size="sm" colorPalette="primary">
            검증 대기: 실행 전
          </Badge>
        </div>
      )}
      {approved && (
        <div className="grid gap-v-50 border-b border-v-normal px-v-200 py-v-150">
          <Badge size="md" colorPalette="success">
            로컬 리뷰 승인 완료
          </Badge>
          <Text typography="body4" foreground="hint-200">
            로컬 리뷰 승인만 기록되었습니다. 저장소 변경이나 PR은 생성되지 않습니다.
          </Text>
        </div>
      )}

      <div
        // A04: tab/tabpanel ARIA 페어. 스크린리더가 현재 active tab 과 본문을
        // 연결하도록 role + aria-labelledby + id 를 명시한다. active 가
        // 없으면 본문 자체가 안내 영역이므로 role 을 생략한다.
        {...(active
          ? {
              role: 'tabpanel' as const,
              id: `artifact-tabpanel-${active.id}`,
              'aria-labelledby': `artifact-tab-${active.id}`,
              tabIndex: 0,
            }
          : {})}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-v-300"
      >
        {active?.id === 'canvas' && canvas && !isTokenSync ? (
          <div className="flex min-h-full min-w-0 flex-col gap-v-300 overflow-x-hidden">
            <ArtifactCanvas
              model={canvas}
              artifactSource={artifactSource}
              activeVariantName={activeVariantName}
              onVariantChange={setActiveVariantName}
              theme={canvasTheme}
              onThemeChange={setCanvasTheme}
            />
            {sections.find((section) => section.id === 'component') && (
              <section className="flex min-w-0 flex-col gap-v-150 border-t border-v-normal pt-v-300">
                <div className="flex flex-col gap-v-50">
                  <Text typography="subtitle2">생성 코드</Text>
                  <Text typography="body4" foreground="hint-200">
                    미리보기와 같은 산출물에서 추출한 코드입니다.
                  </Text>
                </div>
                <Markdown>{sections.find((section) => section.id === 'component')?.content ?? ''}</Markdown>
              </section>
            )}
          </div>
        ) : active?.id === 'metadata' ? (
          <Suspense fallback={<LazyPanelFallback />}>
            <MetadataPanel
              metadata={parsedArtifact?.metadata}
              validation={parsedArtifact?.metadataValidation}
              activeVariantName={activeVariantName}
            />
          </Suspense>
        ) : active?.id === 'token-mapping' ? (
          <Suspense fallback={<LazyPanelFallback />}>
            <TokenSyncPanel />
          </Suspense>
        ) : active?.id === 'validation' ? (
          <Suspense fallback={<LazyPanelFallback />}>
            <ValidationPanel
              result={validationResult}
              status={validationStatus}
              errorMessage={validationErrorMessage}
              runAt={validationRunAt}
              onCopyOutput={(label) => {
                const detail = validationResult?.details.find((d) => d.label === label);
                if (detail?.output) void navigator.clipboard?.writeText(detail.output);
              }}
              onRepairGate={onRepair && artifactSource && validationResult && !repairChainExhausted
                ? (gate) => {
                    if (repairChainExhausted) return;
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
          </Suspense>
        ) : active?.id === 'debug' && debugTrace ? (
          <DebugTracePanel trace={debugTrace} />
        ) : active ? (
          <div aria-live="polite" className="flex min-w-0 flex-col gap-v-150 overflow-x-hidden">
            {active.id === 'story' && Boolean(canvas) && (
              <div className="flex flex-wrap items-center justify-between gap-v-100 rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-200 py-v-150">
                <Text typography="body4">
                  story 코드만 표시됩니다. 각 story 의 props variant 는 Canvas
                  탭에서 실제로 렌더됩니다.
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  colorPalette="primary"
                  onClick={() => setActiveTab('canvas')}
                >
                  Canvas 탭으로 이동
                </Button>
              </div>
            )}
            {active.id === 'test' && (
              <div className="flex flex-wrap items-center justify-between gap-v-100 rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-200 py-v-150">
                <Text typography="body4">
                  test 코드만 표시됩니다. 실제 Vitest 실행 결과·실패 출력은
                  검증 탭에서 확인하세요 ("검증 실행" 으로 트리거).
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  colorPalette="primary"
                  onClick={() => setActiveTab('validation')}
                >
                  검증 탭으로 이동
                </Button>
              </div>
            )}
            <Markdown>{active.content}</Markdown>
          </div>
        ) : (
          <div className="flex h-full flex-col gap-v-300">
            <div className="flex flex-col gap-v-100">
              <Text typography="subtitle2">워크벤치 준비 상태</Text>
              <Text typography="body3" foreground="hint-200">
                요청을 실행하면 Canvas 미리보기, 생성된 파일, 검증 게이트, 보수
                루프가 이곳에서 한 번에 연결됩니다.
              </Text>
            </div>
            <div className="grid gap-v-100 sm:grid-cols-2">
              {[
                ['Canvas 대기', '산출물이 생성되면 미리보기 iframe 을 연결합니다.'],
                ['산출물 파서 대기', '코드 · 스토리 · 테스트 섹션을 추출합니다.'],
                ['검증 게이트 준비됨', '타입 · 단위 테스트 · 렌더 · 접근성 · 토큰을 확인합니다.'],
                ['보수 루프 준비됨', '실패한 게이트의 출력을 에이전트에 다시 보냅니다.'],
              ].map(([title, description]) => (
                <div
                  key={title}
                  className="flex min-h-[96px] flex-col gap-v-50 rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-200 py-v-150"
                >
                  <Text typography="subtitle2">{title}</Text>
                  <Text typography="body4" foreground="hint-200">
                    {description}
                  </Text>
                </div>
              ))}
            </div>
            <div className="grid gap-v-100">
              <Text typography="subtitle2">예상 산출물</Text>
              <div className="grid gap-v-100 text-sm sm:grid-cols-2">
                {['React + TypeScript', 'Storybook 스토리', 'Vitest 테스트', '접근성 + 토큰 확인'].map(
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
  // 사용자가 명시적으로 다시 시도할 때 iframe 을 강제 재로드하기 위한 키.
  const [reloadKey, setReloadKey] = useState(0);
  const previewSrc =
    artifactSource && model.canRunReactPreview && model.metadataValidation.status !== 'fail'
      ? `${previewOrigin}/api/deepseek/preview?artifact=${encodeURIComponent(artifactSource)}&variant=${encodeURIComponent(activeVariantName)}&theme=${theme}&previewRunId=${encodeURIComponent(previewRunId)}&parentOrigin=${encodeURIComponent(parentOrigin)}&reload=${reloadKey}`
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
      if (event.source && event.source !== iframeRef.current?.contentWindow) return;
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
    // 부모 측 verification fetch 는 cross-origin (localhost ↔ 127.0.0.1
    // 토글, host 바인딩, CORS preflight) 에서 "Failed to fetch" 로 떨어지는
    // 경우가 많지만, iframe 자체 로드는 브라우저 직접 요청이라 별개로
    // 성공한다. 따라서 fetch 결과는 "iframe 이 ready postMessage 도, error
    // 도 못 보낸 채 endpoint 가 명확한 HTTP 에러를 반환했을 때" 에 한해
    // 보조 진단 정보로만 사용한다. network-level Failed to fetch 만으로는
    // 캔버스를 실패 상태로 단정하지 않는다.
    void fetch(previewSrc, { signal: abortController.signal })
      .then(async (response) => {
        if (response.ok || settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        const message = await response.text().catch(() => '');
        setPreviewState({
          src: previewSrc,
          status: 'failed',
          error: `Preview endpoint failed (${response.status})${message ? `: ${message}` : ''}`,
        });
      })
      .catch((error: unknown) => {
        // network 단의 Failed to fetch / CORS reject 는 부모 fetch 한정
        // 실패로 취급하지 않는다. iframe 은 브라우저 직접 로드라 별개로
        // 정상 ready 신호를 보낼 수 있고, 못 보내면 timeout 가드가
        // 처리한다. 부모 fetch 결과는 HTTP 4xx/5xx 가 명확한 케이스만
        // failed 로 단정한다.
        if (settled || abortController.signal.aborted) return;
        console.warn(
          '[VaporCanvas] preview fetch warning, iframe 신호를 우선 사용합니다:',
          error,
        );
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
      <div className="flex h-full min-h-[260px] min-w-0 flex-col gap-v-150 overflow-x-hidden">
        <div className="flex min-w-0 flex-col gap-v-25">
          <Text typography="subtitle2">Canvas 사용 불가</Text>
          <Text typography="body4" foreground="hint-200">
            미리보기를 띄우려면 컴포넌트 산출물, 원문, 유효한 메타데이터가 필요합니다.
          </Text>
        </div>
        <div className="flex flex-wrap gap-v-50">
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
              ? `메타데이터: ${statusLabel(model.metadataValidation.status)}`
              : '추정 props'}
          </Badge>
        </div>
        <div
          role="status"
          className="rounded-v-300 border border-dashed border-v-normal bg-v-canvas-200 p-v-300"
        >
          <Text typography="body3">
            {model.metadataValidation.status === 'fail'
              ? `메타데이터 검증 실패: ${model.metadataValidation.errors.join(' ')}`
              : '이 산출물은 실제 미리보기 런타임으로 mount되지 않았습니다. 성공 상태로 표시하지 않고 코드/스토리/테스트 탭에서 원본만 검토합니다.'}
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[360px] min-w-0 flex-col gap-v-200 overflow-x-hidden">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-v-100">
          <div className="flex min-w-0 flex-col gap-v-25">
            <Text typography="subtitle2">미리보기</Text>
            <Text typography="body4" foreground="hint-200">
              생성된 컴포넌트를 격리된 Canvas에서 렌더링합니다.
            </Text>
          </div>
        <div className="flex min-w-0 flex-wrap justify-end gap-v-50 overflow-hidden">
          <Badge size="sm" colorPalette="primary">
            Canvas 미리보기
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
              ? `메타데이터: ${statusLabel(model.metadataValidation.status)}`
              : '추정 props'}
          </Badge>
          <Badge
            size="sm"
            aria-label={`미리보기 런타임: ${previewStatusLabel(previewStatus)}`}
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
            런타임 {previewStatusLabel(previewStatus)}
          </Badge>
        </div>
      </div>
      {!model.hasMetadata && (
        <div className="rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-200 py-v-150">
          <Text typography="body4">
            artifact-meta가 없어 Canvas가 코드/스토리 텍스트에서 props를 추정합니다.
          </Text>
        </div>
      )}
      {model.hasMetadata && model.metadataValidation.status !== 'pass' && (
        <div className="rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-200 py-v-150">
          <Text typography="body4">
            {model.metadataValidation.status === 'fail'
              ? '메타데이터 계약(contract) 실패. 계약을 수정하기 전까지는 Canvas 마운트 상태를 사용할 수 없습니다.'
              : '메타데이터 계약(contract) 경고. Canvas 가 마운트될 수 있지만 계약 검토가 필요합니다.'}
          </Text>
          {model.metadataValidation.messages.map((message) => (
            <Text key={message} typography="body4" foreground="hint-200">
              {message}
            </Text>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-v-50">
        {model.variants.map((variant) => (
          <Button
            key={variant.name}
            size="sm"
            variant={variant.name === activeVariantName ? 'outline' : 'ghost'}
            colorPalette="primary"
            aria-label={`${variant.name} 상태`}
            onClick={() => onVariantChange(variant.name)}
          >
            {variantDisplayName(variant.name)}
          </Button>
        ))}
        <div className="mx-v-100 h-v-300 border-l border-v-normal" />
        {(['light', 'dark'] as const).map((nextTheme) => (
          <Button
            key={nextTheme}
            size="sm"
            variant={nextTheme === theme ? 'outline' : 'ghost'}
            colorPalette="primary"
            aria-label={nextTheme === 'light' ? '라이트 테마' : '다크 테마'}
            onClick={() => onThemeChange(nextTheme)}
          >
            {nextTheme === 'light' ? '라이트' : '다크'}
          </Button>
        ))}
      </div>
      <iframe
        ref={iframeRef}
        title="생성물 Canvas 미리보기"
        sandbox="allow-scripts allow-same-origin"
        src={previewSrc}
        className="min-h-[180px] flex-1 rounded-v-300 border border-v-normal bg-v-canvas-100"
      />
      {previewStatus === 'failed' && (
        <div
          role="alert"
          className="flex flex-col gap-v-100 rounded-v-200 border border-v-danger bg-v-danger-100 px-v-200 py-v-150"
        >
          <Text typography="subtitle2" foreground="danger-200">
            Canvas 렌더 실패
          </Text>
          <Text typography="body4">
            {previewError ?? '생성된 컴포넌트를 마운트할 수 없었습니다.'}
          </Text>
          <Text typography="body4" foreground="hint-200">
            Component / Story / Test 탭에서 코드와 메타데이터를 직접 확인할 수
            있습니다. 모델이 잘못된 export 를 지정했거나 런타임 에러를 던졌을
            가능성이 큽니다.
          </Text>
          <div className="flex flex-wrap gap-v-50">
            <Button
              size="sm"
              variant="outline"
              colorPalette="primary"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              다시 시도
            </Button>
          </div>
        </div>
      )}
      {previewStatus === 'timeout' && (
        <div
          role="alert"
          className="flex flex-col gap-v-100 rounded-v-200 border border-v-warning bg-v-warning-100 px-v-200 py-v-150"
        >
          <Text typography="subtitle2" foreground="warning-200">
            Canvas 런타임 응답 없음
          </Text>
          <Text typography="body4">
            iframe 이 ready 신호를 보내지 않았습니다. 모델 응답이 너무 크거나
            preview 서버가 막혀 있을 수 있어요.
          </Text>
          {previewError && (
            <Text typography="body4" foreground="hint-200">
              {previewError}
            </Text>
          )}
          <div className="flex flex-wrap gap-v-50">
            <Button
              size="sm"
              variant="outline"
              colorPalette="primary"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              다시 시도
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function parseArtifactSections(markdown: string): ArtifactSection[] {
  if (!markdown.trim()) return [];

  const matches = [...markdown.matchAll(/^##\s+(Component|Story|Test|Validation)\s*$/gim)];
  if (matches.length === 0) {
    return [{ id: 'component', label: TAB_LABELS.component, content: markdown }];
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

/** React.lazy 패널 로딩 중 Suspense placeholder. */
function LazyPanelFallback() {
  return (
    <div className="flex items-center gap-v-150 p-v-200">
      <Text typography="body4" foreground="hint-200">
        패널을 불러오는 중...
      </Text>
    </div>
  );
}

/**
 * 디버그 탭 본문. agent client 의 raw 요청/응답을 그대로 노출해 사용자가
 * DeepSeek 가 어떤 prompt 로 호출되고 어떤 SSE 본문이 돌아왔는지 직접
 * 검토할 수 있게 한다. JSON 은 pretty-print, raw response 는 원본 그대로.
 */
function DebugTracePanel({ trace }: { trace: AgentDebugTrace }) {
  const requestJson = (() => {
    try {
      return JSON.stringify(trace.request, null, 2);
    } catch {
      return '[request 직렬화 실패]';
    }
  })();
  const handleCopy = (value: string) => {
    void navigator.clipboard?.writeText(value);
  };
  return (
    <div className="flex min-w-0 flex-col gap-v-300 overflow-x-hidden">
      <div className="flex flex-wrap items-center gap-v-100 rounded-v-200 border border-v-normal bg-v-canvas-200 px-v-200 py-v-150">
        <Badge
          size="sm"
          colorPalette={trace.status === 'done' ? 'success' : 'danger'}
          data-testid="debug-trace-status"
        >
          {trace.status === 'done' ? '완료' : '오류'}
        </Badge>
        <Text typography="body4" foreground="hint-200">
          endpoint: {trace.endpoint}
        </Text>
        <Text typography="body4" foreground="hint-200">
          {trace.durationMs}ms
        </Text>
        {trace.errorMessage && (
          <Text typography="body4" foreground="danger-200">
            {trace.errorMessage}
          </Text>
        )}
      </div>

      <section className="flex min-w-0 flex-col gap-v-100">
        <div className="flex flex-wrap items-center justify-between gap-v-100">
          <Text typography="subtitle2">요청 payload</Text>
          <Button
            size="sm"
            variant="ghost"
            data-testid="debug-copy-request"
            onClick={() => handleCopy(requestJson)}
          >
            요청 복사
          </Button>
        </div>
        <pre
          aria-label="DeepSeek 요청 payload"
          data-testid="debug-request-body"
          className="max-h-72 min-w-0 max-w-full overflow-auto rounded-v-200 border border-v-normal bg-v-canvas-100 p-v-150 font-mono text-xs"
        >
          <code>{requestJson}</code>
        </pre>
      </section>

      <section className="flex min-w-0 flex-col gap-v-100">
        <div className="flex flex-wrap items-center justify-between gap-v-100">
          <Text typography="subtitle2">응답 본문 (raw)</Text>
          <Button
            size="sm"
            variant="ghost"
            data-testid="debug-copy-response"
            onClick={() => handleCopy(trace.responseText)}
          >
            응답 복사
          </Button>
        </div>
        <Text typography="body4" foreground="hint-200">
          SSE 토큰을 순서대로 이어붙인 원본입니다. artifact 태그, code fence,
          fallback prose 가 그대로 포함됩니다.
        </Text>
        <pre
          aria-label="DeepSeek 응답 본문"
          data-testid="debug-response-body"
          className="max-h-96 min-w-0 max-w-full overflow-auto rounded-v-200 border border-v-normal bg-v-canvas-100 p-v-150 font-mono text-xs"
        >
          <code>{trace.responseText || '(empty)'}</code>
        </pre>
      </section>
    </div>
  );
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
  for (const match of source.matchAll(
    /export\s+default\s+(?:(?:function|class)\s+([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*)|\()/g,
  )) {
    names.add('default');
    const identifier = match[1] ?? match[2];
    if (identifier) names.add(identifier);
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

/**
 * Canvas 탭의 "Copy" 가 가져갈 텍스트 요약. 실제 시각 preview 는 별도
 * iframe (`ArtifactCanvas`) 이 렌더하므로 이 텍스트는 사용자가 외부 도구
 * (티켓, 채팅) 로 공유할 때만 쓰인다.
 *
 * 이전 구현은 raw hex literal 이 박힌 HTML/CSS 스니펫을 반환해 Vapor
 * 토큰 규칙을 도구 본체가 위반했었다 (V01). 대신 컴포넌트/variant/theme
 * 상태만 요약한 plain text 를 emit 한다.
 */
function canvasStateSummary({
  componentName,
  variant,
  theme,
}: {
  componentName: string;
  variant: CanvasVariant;
  theme: CanvasTheme;
}): string {
  return [
    'Canvas preview state',
    `- Component: ${componentName}`,
    `- Variant: ${variant.name}${variant.disabled ? ' (disabled)' : ''}`,
    `- Label: ${variant.label}`,
    `- Theme: ${theme}`,
  ].join('\n');
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
