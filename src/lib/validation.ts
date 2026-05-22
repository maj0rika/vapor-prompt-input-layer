import type { FileRejectReason, FileRejection } from '../components/prompt/types';

export type FileConstraints = {
  accept?: string[];
  maxSize?: number;
  multiple?: boolean;
  maxFiles?: number;
};

export type FileCheckResult =
  | { ok: true }
  | { ok: false; reason: FileRejectReason };

/**
 * 파일이 accept 규칙에 부합하는지 검사한다.
 *
 * accept 항목은 확장자(`.png`), 와일드카드 MIME(`image/*`),
 * 정확한 MIME(`application/pdf`) 형태를 지원한다.
 */
export function matchesAccept(file: File, accept?: string[]): boolean {
  if (!accept || accept.length === 0) return true;

  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  return accept.some((raw) => {
    const rule = raw.trim().toLowerCase();
    if (rule === '') return false;
    if (rule.startsWith('.')) return fileName.endsWith(rule);
    if (rule.endsWith('/*')) return fileType.startsWith(rule.slice(0, -1));
    return fileType === rule;
  });
}

/** 단일 파일이 제약 조건을 만족하는지 검사한다. */
export function checkFile(file: File, constraints: FileConstraints): FileCheckResult {
  if (!matchesAccept(file, constraints.accept)) {
    return { ok: false, reason: 'unaccepted-type' };
  }
  if (constraints.maxSize != null && file.size > constraints.maxSize) {
    return { ok: false, reason: 'exceeds-max-size' };
  }
  return { ok: true };
}

export type ValidationResult = {
  accepted: File[];
  rejections: FileRejection[];
};

/**
 * 파일 목록을 제약 조건에 따라 통과/거부로 분류한다.
 *
 * `multiple` 이 아니면 두 번째 파일부터, `maxFiles` 를 넘으면 초과분을
 * `too-many-files` 로 거부한다.
 */
export function validateFiles(
  files: File[],
  constraints: FileConstraints,
): ValidationResult {
  const accepted: File[] = [];
  const rejections: FileRejection[] = [];
  const fileLimit = constraints.multiple === true ? constraints.maxFiles : 1;

  files.forEach((file) => {
    if (fileLimit != null && accepted.length >= fileLimit) {
      rejections.push({ fileName: file.name, reason: 'too-many-files' });
      return;
    }
    const result = checkFile(file, constraints);
    if (result.ok) {
      accepted.push(file);
    } else {
      rejections.push({ fileName: file.name, reason: result.reason });
    }
  });

  return { accepted, rejections };
}

/** 거부 사유에 대한 사람이 읽을 수 있는 메시지. */
export function describeRejection(reason: FileRejectReason): string {
  switch (reason) {
    case 'unaccepted-type':
      return '지원하지 않는 파일 형식입니다.';
    case 'exceeds-max-size':
      return '파일 크기가 허용 범위를 초과했습니다.';
    case 'too-many-files':
      return '파일을 하나만 첨부할 수 있습니다.';
  }
}
