import type { Gate } from '../types.ts';
import type { FileSource } from '../../../server/compliance/collectFileSignals.ts';

export type VaporComponentInput = {
  /** Per-file sources for location-level evidence reporting */
  fileSources: FileSource[];
};

const VAPOR_IMPORT_RE = /@vapor-ui\/core/g;
// 대소문자 구분: 네이티브 <button> vs Vapor <Button> 구별. /gi 사용 시 Vapor 컴포넌트도 매칭되는 오류 발생.
const NATIVE_BUTTON_RE = /<button[\s>]/g;
const NATIVE_INPUT_RE = /<input[\s/>]/g;
const ICON_BUTTON_RE = /<IconButton[^>]*>/g;
const ARIA_LABEL_RE = /aria-label\s*=/g;

function lineOf(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

/**
 * Scans source files for:
 * 1. Presence of @vapor-ui/core imports
 * 2. Native <button> / <input> usage (should use Vapor equivalents)
 * 3. IconButton without aria-label
 *
 * Reports exact file:line for each violation.
 */
export function checkVaporComponents(input: VaporComponentInput): Gate {
  const gateId = 'vapor-components';
  const name = 'Vapor Component Usage';
  const { fileSources } = input;

  // Count imports across all files
  const allContent = fileSources.map((f) => f.content).join('\n');
  const vaporImportCount = allContent.match(VAPOR_IMPORT_RE)?.length ?? 0;

  const evidence: Array<{ message: string; location?: string }> = [];
  const fixGuide: Array<{ title: string; detail: string }> = [];

  let totalNativeButton = 0;
  let totalNativeInput = 0;
  let totalMissingAria = 0;

  for (const fs of fileSources) {
    let m: RegExpExecArray | null;

    // --- Native <button> ---
    const btnRe = new RegExp(NATIVE_BUTTON_RE.source, 'g');
    while ((m = btnRe.exec(fs.content)) !== null) {
      totalNativeButton++;
      evidence.push({
        message: `Native \`<button>\` found. Use Vapor \`<Button>\` instead.`,
        location: `${fs.path}:${lineOf(fs.content, m.index!)}`,
      });
    }

    // --- Native <input> ---
    const inputRe = new RegExp(NATIVE_INPUT_RE.source, 'g');
    while ((m = inputRe.exec(fs.content)) !== null) {
      totalNativeInput++;
      evidence.push({
        message: `Native \`<input>\` found. Use Vapor \`<Input>\` instead.`,
        location: `${fs.path}:${lineOf(fs.content, m.index!)}`,
      });
    }

    // --- IconButton without aria-label ---
    const iconRe = new RegExp(ICON_BUTTON_RE.source, 'g');
    while ((m = iconRe.exec(fs.content)) !== null) {
      if (!ARIA_LABEL_RE.test(m[0])) {
        totalMissingAria++;
        evidence.push({
          message: `<IconButton> missing \`aria-label\`.`,
          location: `${fs.path}:${lineOf(fs.content, m.index!)}`,
        });
      }
    }
  }

  if (vaporImportCount === 0) {
    evidence.push({ message: 'No @vapor-ui/core imports found in source files.' });
    fixGuide.push({
      title: 'Import from @vapor-ui/core',
      detail: "Replace native HTML elements with Vapor components: import { Button, Input } from '@vapor-ui/core'.",
    });
  } else {
    evidence.push({ message: `Found ${vaporImportCount} @vapor-ui/core import(s).` });
  }

  if (totalNativeButton > 0) {
    fixGuide.push({
      title: 'Replace <button> with <Button>',
      detail: "import { Button } from '@vapor-ui/core' and replace native <button> elements.",
    });
  }

  if (totalNativeInput > 0) {
    fixGuide.push({
      title: 'Replace <input> with <Input>',
      detail: "import { Input } from '@vapor-ui/core' and replace native <input> elements.",
    });
  }

  if (totalMissingAria > 0) {
    fixGuide.push({
      title: 'Add aria-label to IconButton',
      detail: 'Every <IconButton> must have a descriptive aria-label for screen reader accessibility.',
    });
  }

  const hasFail = vaporImportCount === 0 || totalNativeButton > 0 || totalNativeInput > 0 || totalMissingAria > 0;

  return {
    gateId,
    name,
    status: hasFail ? 'FAIL' : 'PASS',
    evidence,
    fixGuide,
  };
}
