/**
 * Token Sync mapping table workspace (G013.1).
 *
 * G013 의 순수 모듈 (`buildTokenMap`) 을 사용자에게 노출하는 UI 통합 단계.
 * Figma Variables JSON 을 받아 Vapor token candidate 매핑, unknown report,
 * 생성된 token-map.ts 소스를 한 화면에 표시한다.
 *
 * 입력 우선순위:
 * 1) props.figmaJson (호출자가 명시 주입 — 테스트/스토리북 용)
 * 2) bundled fixture (`src/agent/__fixtures__/figma-variables.example.json`)
 *    — Token Sync 템플릿 deterministic demo 용.
 */
import { useMemo, useState } from 'react';
import { Badge, Button, Text } from '@vapor-ui/core';
import {
  EXAMPLE_FIGMA_VARIABLES,
  buildTokenMap,
  parseFigmaVariables,
  type FigmaVariable,
  type TokenMapResult,
} from '../../agent';

export type TokenSyncPanelProps = {
  /** 외부에서 주입한 Figma Variables JSON. 미지정 시 bundled fixture 사용. */
  figmaJson?: unknown;
};

export function TokenSyncPanel({ figmaJson }: TokenSyncPanelProps) {
  const variables: FigmaVariable[] = useMemo(
    () => parseFigmaVariables(figmaJson ?? EXAMPLE_FIGMA_VARIABLES),
    [figmaJson],
  );
  const result: TokenMapResult = useMemo(() => buildTokenMap(variables), [variables]);
  const [sourceOpen, setSourceOpen] = useState(false);

  if (variables.length === 0) {
    return (
      <div className="flex flex-col gap-v-200 p-v-200">
        <Text typography="body3" foreground="hint-200">
          Figma Variables JSON 이 비어 있습니다. attachment 또는 fixture 를 확인하세요.
        </Text>
      </div>
    );
  }

  const mapped = result.mappings.length;
  const total = mapped + result.unknowns.length;
  const summary = `${total} variables · ${mapped} mapped · ${result.unknowns.length} unknown`;

  return (
    <div className="flex flex-col gap-v-300" data-testid="token-sync-panel">
      {/* Header summary */}
      <div className="flex flex-wrap items-center gap-v-100 border-b border-v-normal pb-v-150">
        <Badge size="sm" colorPalette={result.unknowns.length === 0 ? 'success' : 'warning'}>
          Token Sync
        </Badge>
        <Text typography="body4" foreground="hint-200" data-testid="token-sync-summary">
          {summary}
        </Text>
      </div>

      {/* Mapping table */}
      <section className="flex flex-col gap-v-100">
        <Text typography="subtitle2">Vapor token candidate</Text>
        <div
          className="overflow-x-auto rounded-v-200 border border-v-normal"
          data-testid="token-sync-mapping-table"
        >
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-v-canvas-200">
              <tr>
                <Th>Figma name</Th>
                <Th>category</Th>
                <Th>raw</Th>
                <Th>Vapor token</Th>
                <Th>confidence</Th>
                <Th>reason</Th>
              </tr>
            </thead>
            <tbody>
              {result.mappings.map((m) => (
                <tr
                  key={m.figmaName}
                  data-testid={`token-sync-row-${m.figmaName}`}
                  className="border-t border-v-normal"
                >
                  <Td>
                    <code className="font-mono">{m.figmaName}</code>
                  </Td>
                  <Td>
                    <Badge size="sm" colorPalette={categoryColor(m.category)}>
                      {m.category}
                    </Badge>
                  </Td>
                  <Td>
                    <code className="font-mono">{m.rawValue}</code>
                  </Td>
                  <Td>
                    <code className="font-mono">{m.vaporToken}</code>
                  </Td>
                  <Td>
                    <ConfidenceBadge confidence={m.confidence} />
                  </Td>
                  <Td>
                    <Text typography="body4" foreground="hint-200">
                      {m.reason}
                    </Text>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Unknown report */}
      {result.unknowns.length > 0 && (
        <section className="flex flex-col gap-v-100" data-testid="token-sync-unknowns">
          <div className="flex items-center gap-v-100">
            <Text typography="subtitle2">Unknown variables</Text>
            <Badge size="sm" colorPalette="warning">
              {result.unknowns.length}
            </Badge>
          </div>
          <ul className="flex flex-col gap-v-50">
            {result.unknowns.map((u) => (
              <li key={u.figmaName} className="text-sm">
                <code className="font-mono text-v-hint">{u.figmaName}</code>
                <span className="text-v-hint"> — {u.rawValue}</span>
                <div className="text-xs text-v-hint">{u.reason}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Generated source */}
      <section className="flex flex-col gap-v-100">
        <div className="flex items-center gap-v-100">
          <Text typography="subtitle2">생성된 token-map.ts</Text>
          <Button
            size="sm"
            variant="ghost"
            colorPalette="primary"
            aria-expanded={sourceOpen}
            onClick={() => setSourceOpen((prev) => !prev)}
          >
            {sourceOpen ? '소스 숨기기' : '소스 보기'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-testid="token-sync-copy-source"
            onClick={() => {
              void navigator.clipboard?.writeText(result.generatedSource);
            }}
          >
            소스 복사
          </Button>
        </div>
        {sourceOpen && (
          <pre
            className="max-h-96 overflow-y-auto rounded-v-200 border border-v-normal bg-v-canvas-100 p-v-150 font-mono text-xs"
            aria-label="생성된 token-map.ts"
            data-testid="token-sync-generated-source"
          >
            <code>{result.generatedSource}</code>
          </pre>
        )}
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-v-150 py-v-100 text-xs font-semibold text-v-hint">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-v-150 py-v-100 align-top">{children}</td>;
}

function categoryColor(category: string): 'primary' | 'success' | 'warning' | 'hint' {
  if (category === 'color') return 'primary';
  if (category === 'spacing') return 'success';
  if (category === 'radius') return 'warning';
  return 'hint';
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const palette = confidence >= 100 ? 'success' : confidence >= 80 ? 'primary' : confidence >= 50 ? 'warning' : 'danger';
  return (
    <Badge size="sm" colorPalette={palette}>
      {confidence}
    </Badge>
  );
}
