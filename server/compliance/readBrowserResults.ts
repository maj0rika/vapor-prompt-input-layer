import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type BrowserSmokeResult = {
  generatedAt: string;
  url: string;
  anyOverflow: boolean;
  testedBreakpoints: string[];
  viewports: Array<{
    name: string;
    width: number;
    height: number;
    docOverflow: number;
    bodyOverflow: number;
    consoleErrors: number;
    passed: boolean;
  }>;
};

const RESULT_PATH = ['compliance-results', 'smoke', 'result.json'];
/** 1시간 이상된 결과는 stale — 사용자에게 재실행 안내. */
const STALE_AFTER_MS = 60 * 60 * 1000;

/**
 * scripts/compliance-smoke.ts 가 만든 JSON 을 읽어 layout/responsive
 * 게이트에 전달할 형태로 반환한다. 파일이 없거나 stale 이면 undefined.
 */
export function readBrowserSmokeResult(
  projectRoot: string,
): BrowserSmokeResult | undefined {
  const path = join(projectRoot, ...RESULT_PATH);
  try {
    const stat = statSync(path);
    const age = Date.now() - stat.mtimeMs;
    if (age > STALE_AFTER_MS) return undefined;
    const text = readFileSync(path, 'utf-8');
    return JSON.parse(text) as BrowserSmokeResult;
  } catch {
    return undefined;
  }
}
