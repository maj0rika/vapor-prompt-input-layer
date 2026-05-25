/**
 * Figma Variables → Vapor token mapping (G013).
 *
 * Token Sync mode 의 실무 가치는 Figma Variables JSON 을 받아 Vapor token
 * candidate 를 자동으로 제안하고, 매칭이 안 되는 항목을 unknown report 로
 * 분리하는 것이다. 본 모듈은 순수 함수 집합으로 React/DOM 의존성이 없다.
 *
 * Scope (G013):
 * - color (hex / RGB)
 * - spacing (px)
 * - radius (px)
 * 그 외 (typography, opacity 등) 은 unknown 으로 분리.
 */

export type FigmaVariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

export type FigmaVariable = {
  name: string;
  type: FigmaVariableType;
  /** COLOR: hex (#RRGGBB | #RRGGBBAA) 또는 rgb()/rgba(). FLOAT: px 숫자. */
  value: string | number;
  /** Figma collection group (예: "Brand/Color/Primary"). */
  collection?: string;
};

export type VaporCategory = 'color' | 'spacing' | 'radius' | 'unknown';

export type VaporTokenCandidate = {
  /** Figma variable 원본 이름. */
  figmaName: string;
  /** 카테고리 분류. */
  category: VaporCategory;
  /** 매칭된 Vapor CSS custom property (예: '--vapor-spacing-200'). */
  vaporToken: string | null;
  /** 0~100. 100 = exact, 80 = near, 50 = fallback, 0 = no match. */
  confidence: number;
  /** Figma 원본 값을 사람이 읽을 수 있는 형태로. */
  rawValue: string;
  /** 매칭 근거. */
  reason: string;
};

export type UnknownTokenReport = {
  figmaName: string;
  rawValue: string;
  reason: string;
};

export type TokenMapResult = {
  mappings: VaporTokenCandidate[];
  unknowns: UnknownTokenReport[];
  /** export const FIGMA_TO_VAPOR_TOKENS = { ... } 형식 코드 (token-map.ts 본문). */
  generatedSource: string;
};

// ----------------------------------------------------------------------------
// Vapor token catalog
// ----------------------------------------------------------------------------

/** Vapor spacing scale (px → token name). 8pt grid 기준. */
const VAPOR_SPACING: ReadonlyArray<{ px: number; token: string }> = [
  { px: 2, token: '--vapor-spacing-025' },
  { px: 4, token: '--vapor-spacing-050' },
  { px: 6, token: '--vapor-spacing-075' },
  { px: 8, token: '--vapor-spacing-100' },
  { px: 12, token: '--vapor-spacing-150' },
  { px: 16, token: '--vapor-spacing-200' },
  { px: 20, token: '--vapor-spacing-250' },
  { px: 24, token: '--vapor-spacing-300' },
  { px: 32, token: '--vapor-spacing-400' },
  { px: 40, token: '--vapor-spacing-500' },
  { px: 48, token: '--vapor-spacing-600' },
  { px: 64, token: '--vapor-spacing-800' },
];

const VAPOR_RADIUS: ReadonlyArray<{ px: number; token: string }> = [
  { px: 2, token: '--vapor-radius-050' },
  { px: 4, token: '--vapor-radius-100' },
  { px: 8, token: '--vapor-radius-200' },
  { px: 12, token: '--vapor-radius-300' },
  { px: 16, token: '--vapor-radius-400' },
  { px: 9999, token: '--vapor-radius-full' },
];

/** 자주 쓰는 Vapor color hex anchors. 정확한 시스템 token 은 @vapor-ui/core 에 있음. */
const VAPOR_COLORS: ReadonlyArray<{ hex: string; token: string; role: string }> = [
  { hex: '#FFFFFF', token: '--vapor-color-canvas-100', role: 'canvas-100 (light)' },
  { hex: '#F5F7FA', token: '--vapor-color-canvas-200', role: 'canvas-200 (light)' },
  { hex: '#E5E7EB', token: '--vapor-color-border-normal', role: 'border-normal' },
  { hex: '#0F172A', token: '--vapor-color-foreground-normal-100', role: 'foreground-normal' },
  { hex: '#475569', token: '--vapor-color-foreground-hint-200', role: 'foreground-hint' },
  { hex: '#3B82F6', token: '--vapor-color-foreground-primary-200', role: 'primary' },
  { hex: '#2563EB', token: '--vapor-color-foreground-primary-300', role: 'primary-strong' },
  { hex: '#EF4444', token: '--vapor-color-foreground-danger-200', role: 'danger' },
  { hex: '#10B981', token: '--vapor-color-foreground-success-200', role: 'success' },
  { hex: '#F59E0B', token: '--vapor-color-foreground-warning-200', role: 'warning' },
];

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/** Figma Variables export JSON 의 'variables' 배열을 받아 평탄화한다. */
export function parseFigmaVariables(json: unknown): FigmaVariable[] {
  if (!json || typeof json !== 'object') return [];
  const root = json as Record<string, unknown>;
  const rawList = Array.isArray(root.variables) ? root.variables : [];
  const result: FigmaVariable[] = [];
  for (const raw of rawList) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const name = typeof item.name === 'string' ? item.name : undefined;
    const type = item.type as FigmaVariableType | undefined;
    const value = item.value;
    if (!name || !type) continue;
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      continue;
    }
    result.push({
      name,
      type,
      value: typeof value === 'boolean' ? String(value) : value,
      collection: typeof item.collection === 'string' ? item.collection : undefined,
    });
  }
  return result;
}

/** 한 Figma variable 을 카테고리에 따라 Vapor token candidate 로 매핑. */
export function mapVariable(variable: FigmaVariable): VaporTokenCandidate {
  const category = categorize(variable);
  if (category === 'color') return mapColor(variable);
  if (category === 'spacing') return mapSpacing(variable);
  if (category === 'radius') return mapRadius(variable);
  return {
    figmaName: variable.name,
    category: 'unknown',
    vaporToken: null,
    confidence: 0,
    rawValue: String(variable.value),
    reason: `type=${variable.type} 는 현재 G013 매핑 범위 외입니다.`,
  };
}

/** 전체 매핑 + unknown report + generated source 빌드. */
export function buildTokenMap(variables: FigmaVariable[]): TokenMapResult {
  const mappings: VaporTokenCandidate[] = [];
  const unknowns: UnknownTokenReport[] = [];

  for (const variable of variables) {
    const candidate = mapVariable(variable);
    if (candidate.category === 'unknown' || candidate.vaporToken === null) {
      unknowns.push({
        figmaName: candidate.figmaName,
        rawValue: candidate.rawValue,
        reason: candidate.reason,
      });
      continue;
    }
    mappings.push(candidate);
  }

  return {
    mappings,
    unknowns,
    generatedSource: emitTokenMapSource(mappings, unknowns),
  };
}

// ----------------------------------------------------------------------------
// Categorization + matchers
// ----------------------------------------------------------------------------

function categorize(variable: FigmaVariable): VaporCategory {
  if (variable.type === 'COLOR') return 'color';
  if (variable.type === 'FLOAT') {
    const lower = `${variable.collection ?? ''}/${variable.name}`.toLowerCase();
    if (lower.includes('radius') || lower.includes('corner')) return 'radius';
    if (lower.includes('spacing') || lower.includes('gap') || lower.includes('padding')) {
      return 'spacing';
    }
    // 기본 FLOAT 은 spacing 으로 추정 (가장 흔함)
    return 'spacing';
  }
  return 'unknown';
}

function mapColor(variable: FigmaVariable): VaporTokenCandidate {
  const hex = normalizeHex(String(variable.value));
  if (!hex) {
    return {
      figmaName: variable.name,
      category: 'color',
      vaporToken: null,
      confidence: 0,
      rawValue: String(variable.value),
      reason: 'COLOR 값을 hex 로 파싱할 수 없습니다.',
    };
  }

  let bestIdx = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < VAPOR_COLORS.length; i += 1) {
    const dist = hexDistance(hex, VAPOR_COLORS[i].hex);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  const best = bestIdx >= 0 ? VAPOR_COLORS[bestIdx] : null;
  if (!best) {
    return {
      figmaName: variable.name,
      category: 'color',
      vaporToken: null,
      confidence: 0,
      rawValue: hex,
      reason: 'Vapor color anchor 가 비어 있습니다.',
    };
  }

  const confidence = bestDist === 0 ? 100 : bestDist < 30 ? 85 : bestDist < 80 ? 60 : 30;
  return {
    figmaName: variable.name,
    category: 'color',
    vaporToken: best.token,
    confidence,
    rawValue: hex,
    reason: `Nearest Vapor anchor: ${best.hex} (${best.role}, RGB distance ${bestDist}).`,
  };
}

function mapSpacing(variable: FigmaVariable): VaporTokenCandidate {
  return mapPxScale(variable, VAPOR_SPACING, 'spacing');
}

function mapRadius(variable: FigmaVariable): VaporTokenCandidate {
  return mapPxScale(variable, VAPOR_RADIUS, 'radius');
}

function mapPxScale(
  variable: FigmaVariable,
  scale: ReadonlyArray<{ px: number; token: string }>,
  category: 'spacing' | 'radius',
): VaporTokenCandidate {
  const px = typeof variable.value === 'number' ? variable.value : Number(variable.value);
  if (!Number.isFinite(px)) {
    return {
      figmaName: variable.name,
      category,
      vaporToken: null,
      confidence: 0,
      rawValue: String(variable.value),
      reason: 'FLOAT 값을 숫자로 파싱할 수 없습니다.',
    };
  }

  let bestIdx = -1;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < scale.length; i += 1) {
    const delta = Math.abs(scale[i].px - px);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIdx = i;
    }
  }
  const best = bestIdx >= 0 ? scale[bestIdx] : null;
  if (!best) {
    return {
      figmaName: variable.name,
      category,
      vaporToken: null,
      confidence: 0,
      rawValue: `${px}px`,
      reason: `${category} scale 이 비어 있습니다.`,
    };
  }

  const confidence = bestDelta === 0 ? 100 : bestDelta <= 1 ? 85 : bestDelta <= 4 ? 60 : 30;
  return {
    figmaName: variable.name,
    category,
    vaporToken: best.token,
    confidence,
    rawValue: `${px}px`,
    reason: `Nearest ${category} step: ${best.px}px (delta ${bestDelta}px).`,
  };
}

// ----------------------------------------------------------------------------
// Color helpers
// ----------------------------------------------------------------------------

function normalizeHex(value: string): string | null {
  const trimmed = value.trim().toUpperCase();
  if (/^#[0-9A-F]{6}([0-9A-F]{2})?$/.test(trimmed)) {
    return trimmed.slice(0, 7);
  }
  const rgbMatch = trimmed.match(/^RGBA?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (rgbMatch) {
    const r = clampChannel(Number(rgbMatch[1]));
    const g = clampChannel(Number(rgbMatch[2]));
    const b = clampChannel(Number(rgbMatch[3]));
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  // Figma 가 가끔 0~1 정규화된 RGB 객체를 string 으로 직렬화하는 경우 대비
  if (/^\{.*"r":/.test(trimmed)) {
    try {
      const obj = JSON.parse(trimmed.toLowerCase()) as { r: number; g: number; b: number };
      return `#${toHex(Math.round(obj.r * 255))}${toHex(Math.round(obj.g * 255))}${toHex(
        Math.round(obj.b * 255),
      )}`;
    } catch {
      return null;
    }
  }
  return null;
}

function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 1) return Math.round(value * 255);
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, '0').toUpperCase();
}

function hexDistance(a: string, b: string): number {
  const ra = parseInt(a.slice(1, 3), 16);
  const ga = parseInt(a.slice(3, 5), 16);
  const ba = parseInt(a.slice(5, 7), 16);
  const rb = parseInt(b.slice(1, 3), 16);
  const gb = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  return Math.round(Math.sqrt((ra - rb) ** 2 + (ga - gb) ** 2 + (ba - bb) ** 2));
}

// ----------------------------------------------------------------------------
// Source emitter
// ----------------------------------------------------------------------------

function emitTokenMapSource(
  mappings: VaporTokenCandidate[],
  unknowns: UnknownTokenReport[],
): string {
  const lines: string[] = [];
  lines.push('/**');
  lines.push(' * Figma → Vapor token map (generated by G013).');
  lines.push(' * confidence: 100=exact, 85=near, 60=loose, 30=fallback.');
  lines.push(' */');
  lines.push('export const FIGMA_TO_VAPOR_TOKENS = {');
  for (const m of mappings) {
    lines.push(
      `  ${JSON.stringify(m.figmaName)}: { vaporToken: ${JSON.stringify(
        m.vaporToken,
      )}, category: ${JSON.stringify(m.category)}, confidence: ${m.confidence} },`,
    );
  }
  lines.push('} as const;');
  if (unknowns.length > 0) {
    lines.push('');
    lines.push('export const UNKNOWN_FIGMA_VARIABLES = [');
    for (const u of unknowns) {
      lines.push(
        `  { figmaName: ${JSON.stringify(u.figmaName)}, rawValue: ${JSON.stringify(
          u.rawValue,
        )}, reason: ${JSON.stringify(u.reason)} },`,
      );
    }
    lines.push('] as const;');
  }
  return lines.join('\n');
}
