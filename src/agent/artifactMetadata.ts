import type { ArtifactMetadata } from './responseParser';

export type MetadataValidationStatus = 'pass' | 'warn' | 'fail';

export type MetadataValidationResult = {
  status: MetadataValidationStatus;
  messages: string[];
  warnings: string[];
  errors: string[];
};

type ValidationInput = {
  metadata?: ArtifactMetadata;
  rawMetadata?: string;
  parseError?: string;
  componentSource?: string;
};

const MAX_METADATA_BYTES = 8_192;
const MAX_PROPS_DEPTH = 6;
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function validateArtifactMetadata({
  metadata,
  rawMetadata,
  parseError,
  componentSource,
}: ValidationInput): MetadataValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!rawMetadata) {
    warnings.push('Heuristic props fallback required.');
    return buildResult(warnings, errors);
  }

  if (byteLength(rawMetadata) > MAX_METADATA_BYTES) {
    errors.push('artifact-meta exceeds the supported metadata size limit.');
  }

  if (parseError) {
    errors.push(`artifact-meta must be valid JSON: ${parseError}`);
    return buildResult(warnings, errors);
  }

  const rawObject = parseRawMetadataObject(rawMetadata);
  if (!rawObject) {
    errors.push('artifact-meta must contain a metadata object.');
    return buildResult(warnings, errors);
  }

  if (!metadata) {
    errors.push('artifact-meta must contain a metadata object.');
    return buildResult(warnings, errors);
  }

  if (!metadata.primaryExport) {
    errors.push('artifact-meta primaryExport is required for strict preview.');
  } else if (componentSource && !extractExportNames(componentSource).has(metadata.primaryExport)) {
    errors.push(`primaryExport "${metadata.primaryExport}" does not match a component export.`);
  }

  if (
    metadata.componentName &&
    metadata.primaryExport &&
    metadata.componentName !== metadata.primaryExport
  ) {
    warnings.push('componentName differs from primaryExport.');
  }

  if (!metadata.variants || metadata.variants.length === 0) {
    warnings.push('artifact-meta variants are missing; Default fallback will be used.');
  } else {
    const variantNames = new Set<string>();
    let hasDefault = false;
    for (const variant of metadata.variants) {
      if (variantNames.has(variant.name)) {
        errors.push(`Duplicate variant name "${variant.name}".`);
      }
      variantNames.add(variant.name);
      if (variant.name === 'Default') hasDefault = true;
      validatePropsObject(variant.props, `variant "${variant.name}" props`, warnings, errors);
    }
    if (!hasDefault) {
      warnings.push('Default variant is missing.');
    }
  }

  validateRawPropsShapes(rawObject, errors);
  validatePropsObject(metadata.defaultProps, 'defaultProps', warnings, errors);

  return buildResult(warnings, errors);
}

function parseRawMetadataObject(rawMetadata: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(rawMetadata) as unknown;
    return isPlainObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function validateRawPropsShapes(rawObject: Record<string, unknown>, errors: string[]): void {
  if ('defaultProps' in rawObject && !isPlainObject(rawObject.defaultProps)) {
    errors.push('defaultProps must be a plain object.');
  }
  if ('variants' in rawObject && !Array.isArray(rawObject.variants)) {
    errors.push('variants must be an array.');
    return;
  }
  if (!Array.isArray(rawObject.variants)) return;
  rawObject.variants.forEach((variant, index) => {
    if (!isPlainObject(variant)) {
      errors.push(`variant at index ${index} must be a plain object.`);
      return;
    }
    if (typeof variant.name !== 'string' || !variant.name.trim()) {
      errors.push(`variant at index ${index} name must be a non-empty string.`);
    }
    if ('props' in variant && !isPlainObject(variant.props)) {
      errors.push(`variant at index ${index} props must be a plain object.`);
    }
  });
}

function validatePropsObject(
  value: Record<string, unknown> | undefined,
  label: string,
  warnings: string[],
  errors: string[],
): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    errors.push(`${label} must be a plain object.`);
    return;
  }
  if (!isJsonSerializable(value)) {
    errors.push(`${label} must be JSON-serializable.`);
  }
  const dangerousPath = findDangerousKey(value);
  if (dangerousPath) {
    errors.push(`${label} contains dangerous key "${dangerousPath}".`);
  }
  if (maxDepth(value) > MAX_PROPS_DEPTH) {
    warnings.push(`${label} is deeply nested; keep metadata props shallow.`);
  }
}

function buildResult(warnings: string[], errors: string[]): MetadataValidationResult {
  const status: MetadataValidationStatus = errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass';
  return {
    status,
    messages: [...errors, ...warnings],
    warnings,
    errors,
  };
}

function extractExportNames(source: string): Set<string> {
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
  // `export default` 패턴 — 함수/클래스/식별자/괄호 표현식 모두 'default'
  // 라는 export 이름을 갖는다. 이름이 같이 적힌 경우 (`export default function
  // Foo`) 그 식별자도 함께 등록해 primaryExport 매칭 표면을 넓힌다.
  for (const match of source.matchAll(
    /export\s+default\s+(?:(?:function|class)\s+([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*)|\()/g,
  )) {
    names.add('default');
    const identifier = match[1] ?? match[2];
    if (identifier) names.add(identifier);
  }
  return names;
}

function isJsonSerializable(value: unknown): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function findDangerousKey(value: unknown, path: string[] = []): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  for (const key of Object.keys(value)) {
    const nextPath = [...path, key];
    if (DANGEROUS_KEYS.has(key)) return nextPath.join('.');
    const nested = findDangerousKey((value as Record<string, unknown>)[key], nextPath);
    if (nested) return nested;
  }
  return undefined;
}

function maxDepth(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const entries = Object.values(value as Record<string, unknown>);
  if (entries.length === 0) return 1;
  return 1 + Math.max(...entries.map(maxDepth));
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
