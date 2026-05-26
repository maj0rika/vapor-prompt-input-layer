import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

export type FileSignals = {
  /** Combined source text from all scanned .ts/.tsx files */
  combinedSource: string;
  /** List of scanned file paths (relative) */
  scannedFiles: string[];
  /** README.md content, or undefined if not found */
  readmeContent: string | undefined;
  /** Whether docs/vapor-compliance.md exists */
  vaporComplianceDocExists: boolean;
};

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage']);

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
    } else if (SOURCE_EXTENSIONS.has(extname(entry))) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Reads source files from the project root and collects signals.
 * @param projectRoot Absolute path to the project root
 */
export function collectFileSignals(projectRoot: string): FileSignals {
  const srcDir = join(projectRoot, 'src');
  const scannedFiles = walkSourceFiles(srcDir);
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

  return {
    combinedSource,
    scannedFiles: scannedFiles.map((f) => f.replace(projectRoot + '/', '')),
    readmeContent,
    vaporComplianceDocExists,
  };
}
