import type { Gate } from '../types.ts';
import type { FileSource } from '../../../server/compliance/collectFileSignals.ts';

export type TokenRulesInput = {
  /** Per-file sources for location-level evidence reporting */
  fileSources: FileSource[];
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

/**
 * Find the line number of a regex match in a string.
 */
function lineOf(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

/**
 * Extract the first N characters of the matched line as a snippet.
 */
function snippetAt(content: string, matchIndex: number, maxLen = 60): string {
  const lineStart = content.lastIndexOf('\n', matchIndex) + 1;
  const lineEnd = content.indexOf('\n', matchIndex);
  const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
  return line.length > maxLen ? line.slice(0, maxLen) + '…' : line;
}

/**
 * Scans source files for raw color values and hard-coded spacing tokens.
 * - Raw hex / CSS color functions → FAIL
 * - Hard-coded px spacing in Tailwind arbitrary or inline styles → WARN
 * Reports exact file:line for each violation.
 */
export function checkTokens(input: TokenRulesInput): Gate {
  const gateId = 'design-tokens';
  const name = 'Design Token Usage';
  const { fileSources } = input;

  const evidence: Array<{ message: string; location?: string }> = [];
  const fixGuide: Array<{ title: string; detail: string }> = [];

  let totalHex = 0;
  let totalColorFn = 0;
  let totalSpacing = 0;

  for (const fs of fileSources) {
    // --- Hex colors ---
    let m: RegExpExecArray | null;
    const hexRe = new RegExp(HEX_COLOR_RE.source, 'g');
    while ((m = hexRe.exec(fs.content)) !== null) {
      totalHex++;
      const line = lineOf(fs.content, m.index!);
      const snippet = snippetAt(fs.content, m.index!);
      evidence.push({
        message: `Raw hex color: \`${m[0]}\` — ${snippet}`,
        location: `${fs.path}:${line}`,
      });
    }

    // --- CSS color functions ---
    const cssFnRe = new RegExp(CSS_COLOR_FN_RE.source, 'gi');
    while ((m = cssFnRe.exec(fs.content)) !== null) {
      totalColorFn++;
      const line = lineOf(fs.content, m.index!);
      const snippet = snippetAt(fs.content, m.index!);
      evidence.push({
        message: `Raw CSS color function: \`${m[0]}\` — ${snippet}`,
        location: `${fs.path}:${line}`,
      });
    }

    // --- Tailwind arbitrary spacing ---
    const twSpRe = new RegExp(ARBITRARY_TAILWIND_SPACING_RE.source, 'g');
    while ((m = twSpRe.exec(fs.content)) !== null) {
      totalSpacing++;
      const line = lineOf(fs.content, m.index!);
      const snippet = snippetAt(fs.content, m.index!);
      evidence.push({
        message: `Arbitrary Tailwind spacing: \`${m[0]}\` — ${snippet}`,
        location: `${fs.path}:${line}`,
      });
    }

    // --- Inline px spacing ---
    const pxSpRe = new RegExp(INLINE_PX_SPACING_RE.source, 'gi');
    while ((m = pxSpRe.exec(fs.content)) !== null) {
      totalSpacing++;
      const line = lineOf(fs.content, m.index!);
      const snippet = snippetAt(fs.content, m.index!);
      evidence.push({
        message: `Hard-coded inline spacing — ${snippet}`,
        location: `${fs.path}:${line}`,
      });
    }
  }

  const rawColorCount = totalHex + totalColorFn;

  if (totalHex > 0) {
    fixGuide.push({
      title: 'Replace hex colors with Vapor tokens',
      detail: 'Use Vapor color tokens (e.g. bg-v-primary, text-v-secondary) instead of raw hex values.',
    });
  }

  if (totalColorFn > 0) {
    fixGuide.push({
      title: 'Replace CSS color functions with Vapor tokens',
      detail: 'Use var(--vapor-color-*) CSS custom properties or Vapor utility classes instead.',
    });
  }

  if (totalSpacing > 0) {
    fixGuide.push({
      title: 'Replace hard-coded spacing with Vapor spacing tokens',
      detail: 'Use Vapor spacing tokens (p-v-*, gap-v-*) or Tailwind scale classes instead of arbitrary [Npx] values.',
    });
  }

  if (rawColorCount === 0 && totalSpacing === 0) {
    evidence.push({ message: 'No raw color or spacing values detected.' });
  }

  const status = rawColorCount > 0 ? 'FAIL' : totalSpacing > 0 ? 'WARN' : 'PASS';

  return {
    gateId,
    name,
    status,
    evidence,
    fixGuide,
  };
}
