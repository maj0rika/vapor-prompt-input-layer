import type { Gate } from '../types.ts';

export type VaporComponentInput = {
  /** Combined source text of all scanned files */
  source: string;
};

const VAPOR_IMPORT_RE = /@vapor-ui\/core/g;
// 대소문자 구분: 네이티브 <button> vs Vapor <Button> 구별. /gi 사용 시 Vapor 컴포넌트도 매칭되는 오류 발생.
const NATIVE_BUTTON_RE = /<button[\s>]/g;
const NATIVE_INPUT_RE = /<input[\s/>]/g;
const ICON_BUTTON_RE = /<IconButton[^>]*>/g;
const ARIA_LABEL_RE = /aria-label\s*=/g;

/**
 * Scans source files for:
 * 1. Presence of @vapor-ui/core imports
 * 2. Native <button> / <input> usage (should use Vapor equivalents)
 * 3. IconButton without aria-label
 */
export function checkVaporComponents(input: VaporComponentInput): Gate {
  const gateId = 'vapor-components';
  const name = 'Vapor Component Usage';
  const { source } = input;

  const vaporImportCount = source.match(VAPOR_IMPORT_RE)?.length ?? 0;
  const nativeButtonCount = source.match(NATIVE_BUTTON_RE)?.length ?? 0;
  const nativeInputCount = source.match(NATIVE_INPUT_RE)?.length ?? 0;

  const iconButtonMatches = source.match(ICON_BUTTON_RE) ?? [];
  const missingAriaLabelCount = iconButtonMatches.filter(
    (tag) => !ARIA_LABEL_RE.test(tag),
  ).length;

  const evidence = [];
  const fixGuide = [];

  if (vaporImportCount === 0) {
    evidence.push({ message: 'No @vapor-ui/core imports found in source files.' });
    fixGuide.push({
      title: 'Import from @vapor-ui/core',
      detail: "Replace native HTML elements with Vapor components: import { Button, Input } from '@vapor-ui/core'.",
    });
  } else {
    evidence.push({ message: `Found ${vaporImportCount} @vapor-ui/core import(s).` });
  }

  if (nativeButtonCount > 0) {
    evidence.push({
      message: `Found ${nativeButtonCount} native <button> element(s). Use Vapor <Button> instead.`,
    });
    fixGuide.push({
      title: 'Replace <button> with <Button>',
      detail: "import { Button } from '@vapor-ui/core' and replace native <button> elements.",
    });
  }

  if (nativeInputCount > 0) {
    evidence.push({
      message: `Found ${nativeInputCount} native <input> element(s). Use Vapor <Input> instead.`,
    });
    fixGuide.push({
      title: 'Replace <input> with <Input>',
      detail: "import { Input } from '@vapor-ui/core' and replace native <input> elements.",
    });
  }

  if (missingAriaLabelCount > 0) {
    evidence.push({
      message: `Found ${missingAriaLabelCount} <IconButton> element(s) missing aria-label.`,
    });
    fixGuide.push({
      title: 'Add aria-label to IconButton',
      detail: 'Every <IconButton> must have a descriptive aria-label for screen reader accessibility.',
    });
  }

  const hasFail = vaporImportCount === 0 || nativeButtonCount > 0 || nativeInputCount > 0 || missingAriaLabelCount > 0;

  return {
    gateId,
    name,
    status: hasFail ? 'FAIL' : 'PASS',
    evidence,
    fixGuide,
  };
}
