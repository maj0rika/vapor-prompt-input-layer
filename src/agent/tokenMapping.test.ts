import { describe, expect, it } from 'vitest';
import {
  buildTokenMap,
  mapVariable,
  parseFigmaVariables,
  type FigmaVariable,
} from './tokenMapping';

const FIGMA_FIXTURE = {
  variables: [
    { name: 'brand/primary/base', type: 'COLOR', value: '#3B82F6' },
    { name: 'brand/primary/strong', type: 'COLOR', value: '#2563EB' },
    { name: 'surface/canvas/light', type: 'COLOR', value: '#FFFFFF' },
    { name: 'surface/canvas/near-light', type: 'COLOR', value: '#FAFCFE' }, // near
    { name: 'spacing/sm', type: 'FLOAT', value: 8, collection: 'Spacing' },
    { name: 'spacing/md', type: 'FLOAT', value: 16, collection: 'Spacing' },
    { name: 'spacing/odd', type: 'FLOAT', value: 17, collection: 'Spacing' }, // near
    { name: 'corner/radius/md', type: 'FLOAT', value: 8, collection: 'Radius' },
    { name: 'typography/heading/h1', type: 'STRING', value: 'Pretendard 32' }, // unknown
    { name: 'shadow/opacity', type: 'BOOLEAN', value: true }, // unknown via type
  ],
};

describe('parseFigmaVariables', () => {
  it('Figma export JSON 의 variables 배열을 평탄화한다', () => {
    const vars = parseFigmaVariables(FIGMA_FIXTURE);
    expect(vars).toHaveLength(10);
    expect(vars[0]).toMatchObject({ name: 'brand/primary/base', type: 'COLOR', value: '#3B82F6' });
  });

  it('잘못된 JSON 은 빈 배열', () => {
    expect(parseFigmaVariables(null)).toEqual([]);
    expect(parseFigmaVariables({ variables: 'not-array' })).toEqual([]);
    expect(parseFigmaVariables({ variables: [{ name: 'x' /* missing type */ }] })).toEqual([]);
  });
});

describe('mapVariable color', () => {
  it('exact match → confidence 100', () => {
    const c = mapVariable({ name: 'brand/primary', type: 'COLOR', value: '#3B82F6' });
    expect(c.category).toBe('color');
    expect(c.vaporToken).toBe('--vapor-color-foreground-primary-200');
    expect(c.confidence).toBe(100);
  });

  it('near match → confidence 60~85', () => {
    const c = mapVariable({ name: 'surface/canvas/near', type: 'COLOR', value: '#FAFCFE' });
    expect(c.category).toBe('color');
    expect(c.vaporToken).toContain('--vapor-color-canvas');
    expect(c.confidence).toBeGreaterThanOrEqual(60);
    expect(c.confidence).toBeLessThan(100);
  });

  it('rgb() 표기 파싱', () => {
    const c = mapVariable({ name: 'x', type: 'COLOR', value: 'rgb(59, 130, 246)' });
    expect(c.vaporToken).toBe('--vapor-color-foreground-primary-200');
    expect(c.confidence).toBe(100);
  });
});

describe('mapVariable spacing/radius', () => {
  it('FLOAT 16 → spacing-200 exact', () => {
    const c = mapVariable({ name: 'spacing/md', type: 'FLOAT', value: 16, collection: 'Spacing' });
    expect(c.category).toBe('spacing');
    expect(c.vaporToken).toBe('--vapor-spacing-200');
    expect(c.confidence).toBe(100);
  });

  it('near spacing 17 → nearest 16 (spacing-200), confidence < 100', () => {
    const c = mapVariable({ name: 'spacing/odd', type: 'FLOAT', value: 17, collection: 'Spacing' });
    expect(c.vaporToken).toBe('--vapor-spacing-200');
    expect(c.confidence).toBeLessThan(100);
    expect(c.confidence).toBeGreaterThanOrEqual(60);
  });

  it('radius 컬렉션 이름으로 radius 분류', () => {
    const c = mapVariable({ name: 'corner/md', type: 'FLOAT', value: 8, collection: 'Radius' });
    expect(c.category).toBe('radius');
    expect(c.vaporToken).toBe('--vapor-radius-200');
  });
});

describe('mapVariable unknown', () => {
  it('STRING 은 unknown', () => {
    const c = mapVariable({ name: 'h1', type: 'STRING', value: 'Pretendard 32' } as FigmaVariable);
    expect(c.category).toBe('unknown');
    expect(c.vaporToken).toBeNull();
    expect(c.confidence).toBe(0);
  });

  it('잘못된 hex color → vaporToken null', () => {
    const c = mapVariable({ name: 'bad', type: 'COLOR', value: 'not-a-color' });
    expect(c.category).toBe('color');
    expect(c.vaporToken).toBeNull();
  });
});

describe('buildTokenMap', () => {
  it('mappings + unknowns + generatedSource 빌드', () => {
    const result = buildTokenMap(parseFigmaVariables(FIGMA_FIXTURE));
    // STRING + BOOLEAN 2개 = unknown
    expect(result.unknowns.length).toBeGreaterThanOrEqual(2);
    expect(result.unknowns.some((u) => u.figmaName.includes('typography'))).toBe(true);
    // mappings 에는 color/spacing/radius 가 포함
    expect(result.mappings.some((m) => m.category === 'color')).toBe(true);
    expect(result.mappings.some((m) => m.category === 'spacing')).toBe(true);
    expect(result.mappings.some((m) => m.category === 'radius')).toBe(true);
    // generated source 는 export const + entries 포함
    expect(result.generatedSource).toContain('export const FIGMA_TO_VAPOR_TOKENS');
    expect(result.generatedSource).toContain('"brand/primary/base"');
    expect(result.generatedSource).toContain('UNKNOWN_FIGMA_VARIABLES');
  });

  it('unknowns 가 0 이면 UNKNOWN 블록을 emit 하지 않음', () => {
    const result = buildTokenMap([
      { name: 'x', type: 'COLOR', value: '#FFFFFF' },
      { name: 'y', type: 'FLOAT', value: 8, collection: 'Spacing' },
    ]);
    expect(result.unknowns).toEqual([]);
    expect(result.generatedSource).not.toContain('UNKNOWN_FIGMA_VARIABLES');
  });
});
