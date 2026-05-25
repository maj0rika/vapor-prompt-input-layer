/**
 * Read-only metadata viewer (G015).
 *
 * artifact-meta 계약 (primaryExport / defaultProps / variants) 와 metadata
 * validation messages 를 사용자에게 그대로 노출한다. 수정 가능한 inspector 는
 * 본 story 범위 외이며, 본 패널은 디버깅 + 면접 demo 용도의 투명성 도구다.
 */
import { Badge, Text } from '@vapor-ui/core';
import type {
  ArtifactMetadata,
  ArtifactVariantMetadata,
  MetadataValidationResult,
} from '../../agent';

export type MetadataPanelProps = {
  metadata?: ArtifactMetadata;
  validation?: MetadataValidationResult;
  /** 현재 Canvas 에서 활성화된 variant 이름 (있으면 강조 표시). */
  activeVariantName?: string;
};

export function MetadataPanel({ metadata, validation, activeVariantName }: MetadataPanelProps) {
  if (!metadata) {
    return (
      <div className="flex flex-col gap-v-200 p-v-200">
        <Text typography="body3" foreground="hint-200">
          artifact-meta 가 비어 있습니다. metadata 가 없는 경우 Canvas 는 휴리스틱
          fallback 으로 동작합니다.
        </Text>
      </div>
    );
  }

  const variants = metadata.variants ?? [];
  const selectedVariant = activeVariantName
    ? variants.find((v) => v.name === activeVariantName)
    : undefined;

  return (
    <div className="flex flex-col gap-v-300" data-testid="metadata-panel">
      {/* Primary export + componentName */}
      <section className="flex flex-col gap-v-100">
        <Text typography="subtitle2">기본 정보</Text>
        <DataRow label="컴포넌트 이름" value={metadata.componentName ?? '(미지정)'} testId="metadata-component-name" />
        <DataRow label="primaryExport" value={metadata.primaryExport ?? '(미지정)'} testId="metadata-primary-export" />
      </section>

      {/* Validation messages */}
      {validation && validation.status !== 'pass' && (
        <section className="flex flex-col gap-v-100" data-testid="metadata-validation">
          <div className="flex items-center gap-v-100">
            <Text typography="subtitle2">계약 검증</Text>
            <Badge
              size="sm"
              colorPalette={validation.status === 'fail' ? 'danger' : 'warning'}
            >
              {validation.status === 'fail' ? '실패' : '경고'}
            </Badge>
          </div>
          {validation.errors.length > 0 && (
            <ul className="flex flex-col gap-v-50">
              {validation.errors.map((e, i) => (
                <li key={`err-${i}`} className="text-sm text-v-danger">
                  • {e}
                </li>
              ))}
            </ul>
          )}
          {validation.warnings.length > 0 && (
            <ul className="flex flex-col gap-v-50">
              {validation.warnings.map((w, i) => (
                <li key={`warn-${i}`} className="text-sm text-v-warning">
                  • {w}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Default props */}
      <section className="flex flex-col gap-v-100">
        <Text typography="subtitle2">defaultProps</Text>
        <PropsTable props={metadata.defaultProps} testId="metadata-default-props" />
      </section>

      {/* Variants */}
      <section className="flex flex-col gap-v-150">
        <Text typography="subtitle2">variants ({variants.length})</Text>
        {variants.length === 0 ? (
          <Text typography="body4" foreground="hint-200">
            variants 가 비어 있습니다.
          </Text>
        ) : (
          <div className="flex flex-col gap-v-150">
            {variants.map((variant) => (
              <VariantCard
                key={variant.name}
                variant={variant}
                active={variant.name === activeVariantName}
              />
            ))}
          </div>
        )}
      </section>

      {/* Selected variant detail */}
      {selectedVariant && (
        <section
          className="flex flex-col gap-v-100 rounded-v-200 border border-v-primary bg-v-primary-100 px-v-200 py-v-150"
          data-testid="metadata-selected-variant"
        >
          <div className="flex items-center gap-v-100">
            <Text typography="subtitle2">선택된 variant</Text>
            <Badge size="sm" colorPalette="primary">
              {selectedVariant.name}
            </Badge>
          </div>
          <PropsTable
            props={selectedVariant.props}
            testId="metadata-selected-variant-props"
          />
        </section>
      )}
    </div>
  );
}

function DataRow({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-v-150 text-sm">
      <span className="text-v-hint">{label}</span>
      <code
        className="rounded-v-100 bg-v-canvas-200 px-v-100 py-v-50 font-mono text-xs"
        data-testid={testId}
      >
        {value}
      </code>
    </div>
  );
}

function VariantCard({
  variant,
  active,
}: {
  variant: ArtifactVariantMetadata;
  active: boolean;
}) {
  return (
    <div
      data-testid={`metadata-variant-${variant.name}`}
      className={[
        'flex flex-col gap-v-100 rounded-v-200 border px-v-200 py-v-150',
        active ? 'border-v-primary bg-v-primary-100' : 'border-v-normal bg-v-canvas-200',
      ].join(' ')}
    >
      <div className="flex items-center gap-v-100">
        <Text typography="body3">{variant.name}</Text>
        {active && (
          <Badge size="sm" colorPalette="primary">
            활성
          </Badge>
        )}
      </div>
      <PropsTable props={variant.props} />
    </div>
  );
}

function PropsTable({
  props,
  testId,
}: {
  props?: Record<string, unknown>;
  testId?: string;
}) {
  const entries = props ? Object.entries(props) : [];
  if (entries.length === 0) {
    return (
      <Text typography="body4" foreground="hint-200" data-testid={testId}>
        (props 없음)
      </Text>
    );
  }
  return (
    <div className="grid grid-cols-[140px_1fr] gap-v-100" data-testid={testId}>
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <code className="text-xs text-v-hint">{key}</code>
          <code className="rounded-v-100 bg-v-canvas-100 px-v-100 py-v-50 font-mono text-xs">
            {formatValue(value)}
          </code>
        </div>
      ))}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}
