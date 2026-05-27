import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

export type FileSource = {
  path: string;
  content: string;
};

export type FileSignals = {
  /** Combined source text from all scanned .ts/.tsx files */
  combinedSource: string;
  /** Per-file content for location-level evidence reporting */
  fileSources: FileSource[];
  /** List of scanned file paths (relative) */
  scannedFiles: string[];
  /** README.md content, or undefined if not found */
  readmeContent: string | undefined;
  /** Whether docs/vapor-compliance.md exists */
  vaporComplianceDocExists: boolean;
  /** tsconfig.app.json raw text, or undefined if not found */
  tsconfigText: string | undefined;
  /** package.json scripts keys, or undefined if not found */
  scriptNames: string[] | undefined;
};

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage']);

/**
 * 컴플라이언스 스캔에서 제외할 파일 패턴.
 * 테스트 픽스처/모크는 production 번들에 들어가지 않으므로 검사 의미 없음.
 * (raw color string 등 의도적 sample 문자열이 false positive 유발.)
 */
const EXCLUDED_FILE_PATTERNS: RegExp[] = [
  /\.test\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
  /\bmock[A-Z]\w*\.[tj]sx?$/,
  /\bmockReport\.[tj]sx?$/,
  /__fixtures__\//,
];

function isExcludedFile(absPath: string): boolean {
  return EXCLUDED_FILE_PATTERNS.some((re) => re.test(absPath));
}

/**
 * Compliance 가 강제하는 governed 경로. verify:compliance 는 이 범위만 검사한다.
 * 사용자에게 노출되는 UI 만 포함. 검사 엔진 자신 (src/compliance/rules/) 은
 * 위반 패턴을 문자열로 참조하므로 scope 에서 제외 (false positive 회피).
 * 레거시 (src/agent, src/components/chat 등) 는 별도 audit 모드에서 확인.
 */
export const GOVERNED_SCAN_PATHS = [
  'src/components/compliance',
  'src/app/CompliancePage.tsx',
  'src/app/App.tsx',
];

export type ScanScope = 'all' | 'governed';

export type CollectOptions = {
  /** 'all' = 전체 src/ 감사, 'governed' = 강제 경로만 (verify:compliance) */
  scope?: ScanScope;
};

/**
 * Recursively walks a directory and returns all source files.
 */
function walkSourceFiles(dir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...walkSourceFiles(fullPath));
    } else if (SOURCE_EXTENSIONS.has(extname(entry)) && !isExcludedFile(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function collectFromPath(absPath: string): string[] {
  try {
    const stat = statSync(absPath);
    if (stat.isDirectory()) return walkSourceFiles(absPath);
    if (SOURCE_EXTENSIONS.has(extname(absPath)) && !isExcludedFile(absPath)) return [absPath];
  } catch {
    // missing path is fine — governed list may include not-yet-existing files
  }
  return [];
}

/**
 * Reads source files from the project root and collects signals.
 * @param projectRoot Absolute path to the project root
 * @param options.scope 'all' (default) | 'governed' (compliance-managed paths only)
 */
export function collectFileSignals(
  projectRoot: string,
  options: CollectOptions = {},
): FileSignals {
  const scope = options.scope ?? 'all';
  let scannedFiles: string[];
  if (scope === 'governed') {
    scannedFiles = GOVERNED_SCAN_PATHS.flatMap((rel) =>
      collectFromPath(join(projectRoot, rel)),
    );
  } else {
    const srcDir = join(projectRoot, 'src');
    scannedFiles = walkSourceFiles(srcDir);
  }
  const combinedSource = scannedFiles
    .map((f) => {
      try {
        return readFileSync(f, 'utf-8');
      } catch {
        return '';
      }
    })
    .join('\n');

  let readmeContent: string | undefined;
  try {
    readmeContent = readFileSync(join(projectRoot, 'README.md'), 'utf-8');
  } catch {
    readmeContent = undefined;
  }

  let vaporComplianceDocExists = false;
  try {
    statSync(join(projectRoot, 'docs', 'vapor-compliance.md'));
    vaporComplianceDocExists = true;
  } catch {
    vaporComplianceDocExists = false;
  }

  let tsconfigText: string | undefined;
  try {
    tsconfigText = readFileSync(join(projectRoot, 'tsconfig.app.json'), 'utf-8');
  } catch {
    tsconfigText = undefined;
  }

  let scriptNames: string[] | undefined;
  try {
    const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));
    scriptNames = Object.keys(pkg.scripts ?? {});
  } catch {
    scriptNames = undefined;
  }

  const relativeFiles = scannedFiles.map((f) => f.replace(projectRoot + '/', ''));
  const fileSources = scannedFiles.map((f, i) => ({
    path: relativeFiles[i],
    content: (() => { try { return readFileSync(f, 'utf-8'); } catch { return ''; } })(),
  }));

  return {
    combinedSource,
    fileSources,
    scannedFiles: relativeFiles,
    readmeContent,
    vaporComplianceDocExists,
    tsconfigText,
    scriptNames,
  };
}
