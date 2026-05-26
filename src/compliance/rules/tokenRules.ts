import type { Gate } from '../types.ts';

export type TokenRulesInput = {
  /** Combined source text of all scanned files */
  source: string;
};

/** hex literal: #abc, #aabbcc, #aabbccdd */
const HEX_COLOR_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

/** CSS color functions: rgb(), rgba(), hsl(), hsla(), oklch(), etc. */
const CSS_COLOR_FN_RE = /(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\s*\(/gi;

/** Tailwind arbitrary spacing: p-[16px], mt-[8px], gap-[12rem] */
const ARBITRARY_TAILWIND_SPACING_RE =
  /\b(?:p|m|px|py|pt|pr|pb|pl|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y)-\[\s*-?\d+(?:\.\d+)?(?:px|rem|em)\s*\]/g;

/** Hard-coded px spacing in inline style objects */
const INLINE_PX_SPACING_RE =
  /(?:padding(?:Left|Right|Top|Bottom)?|margin(?:Left|Right|Top|Bottom)?|gap(?:Column|Row)?|top|right|bottom|left|inset)\s*[:=]\s*['"]?-?\d+(?:\.\d+)?(?:px|rem|em)\b/gi;

function countMatches(source: string, re: RegExp): number {
  return source.match(re)?.length ?? 0;
}

/**
 * Scans source for raw color values and hard-coded spacing tokens.
 * - Raw hex / CSS color functions → FAIL
 * - Hard-coded px spacing in Tailwind arbitrary or inline styles → WARN
 */
export function checkTokens(input: TokenRulesInput): Gate {
  const gateId = 'design-tokens';
  const name = 'Design Token Usage';
  const { source } = input;

  const hexCount = countMatches(source, HEX_COLOR_RE);
  const colorFnCount = countMatches(source, CSS_COLOR_FN_RE);
  const rawColorCount = hexCount + colorFnCount;

  const tailwindSpacingCount = countMatches(source, ARBITRARY_TAILWIND_SPACING_RE);
  const inlinePxCount = countMatches(source, INLINE_PX_SPACING_RE);
  const rawSpacingCount = tailwindSpacingCount + inlinePxCount;

  const evidence = [];
  const fixGuide = [];

  if (hexCount > 0) {
    evidence.push({ message: `Found ${hexCount} raw hex color value(s) (e.g. #ff0000).` });
    fixGuide.push({
      title: 'Replace hex colors with Vapor tokens',
      detail: "Use Vapor color tokens (e.g. bg-v-primary, text-v-secondary) instead of raw hex values.",
    });
  }

  if (colorFnCount > 0) {
    evidence.push({
      message: `Found ${colorFnCount} raw CSS color function(s) (rgb/hsl/oklch etc.).`,
    });
    fixGuide.push({
      title: 'Replace CSS color functions with Vapor tokens',
      detail: "Use var(--vapor-color-*) CSS custom properties or Vapor utility classes instead.",
    });
  }

  if (rawSpacingCount > 0) {
    evidence.push({
      message: `Found ${rawSpacingCount} hard-coded spacing value(s) (px/rem in inline styles or Tailwind arbitrary).`,
    });
    fixGuide.push({
      title: 'Replace hard-coded spacing with Vapor spacing tokens',
      detail: "Use Vapor spacing tokens (p-v-*, gap-v-*) or Tailwind scale classes instead of arbitrary [Npx] values.",
    });
  }

  if (rawColorCount === 0 && rawSpacingCount === 0) {
    evidence.push({ message: 'No raw color or spacing values detected.' });
  }

  const status = rawColorCount > 0 ? 'FAIL' : rawSpacingCount > 0 ? 'WARN' : 'PASS';

  return {
    gateId,
    name,
    status,
    evidence,
    fixGuide,
  };
}
