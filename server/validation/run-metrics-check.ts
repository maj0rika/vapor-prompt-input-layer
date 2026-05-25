#!/usr/bin/env node
/**
 * `docs/production-metrics.md` 의 절대 지표 중 grep/AST 단위로 정적으로
 * 측정 가능한 항목을 일괄 검증한다. 동적 게이트 (typecheck/lint/test/build/
 * bundle/verify:generated/verify:lighthouse/test:e2e) 는 별도 npm script
 * 에서 이미 강제되므로 본 스크립트는 정적 보안 / DS conformance / UX
 * coherence 항목을 다룬다.
 *
 * 모든 지표가 PASS 면 exit 0. 하나라도 FAIL 이면 exit 1 + JSON 결과 출력.
 *
 * 사용:
 *   node server/validation/run-metrics-check.ts
 *   npm run verify:metrics
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

type Verdict = { id: string; label: string; status: 'pass' | 'fail'; detail?: string };

const ROOT = resolve(import.meta.dirname, '..', '..');

async function readTextRecursive(
  dir: string,
  extensions: string[],
  excludeBasenames: string[] = [],
): Promise<Array<{ path: string; content: string }>> {
  const out: Array<{ path: string; content: string }> = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      if (excludeBasenames.some((bad) => entry.name.includes(bad))) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && extensions.some((ext) => full.endsWith(ext))) {
        const content = await readFile(full, 'utf8');
        out.push({ path: full, content });
      }
    }
  }
  return out;
}

function rel(p: string): string {
  return relative(ROOT, p).split(sep).join('/');
}

const verdicts: Verdict[] = [];

function pass(id: string, label: string, detail?: string): void {
  verdicts.push({ id, label, status: 'pass', detail });
}

function fail(id: string, label: string, detail: string): void {
  verdicts.push({ id, label, status: 'fail', detail });
}

function record(
  ok: boolean,
  id: string,
  label: string,
  failDetail: string,
  passDetail?: string,
): void {
  if (ok) {
    pass(id, label, passDetail);
  } else {
    fail(id, label, failDetail);
  }
}

async function run(): Promise<void> {
  const componentsDir = join(ROOT, 'src', 'components');
  const componentFiles = await readTextRecursive(
    componentsDir,
    ['.ts', '.tsx'],
    ['.test.', '.stories.'],
  );

  // V01: 도구 자체의 raw hex 0건
  const rawHexHits: string[] = [];
  for (const file of componentFiles) {
    const matches = file.content.match(/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g);
    if (matches) {
      // 주석 라인은 제외
      const lines = file.content.split('\n');
      for (const [idx, line] of lines.entries()) {
        if (/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/.test(line)) {
          if (/^\s*\/\/|^\s*\*|\*\s/.test(line)) continue;
          rawHexHits.push(`${rel(file.path)}:${idx + 1}`);
        }
      }
    }
  }
  record(
    rawHexHits.length === 0,
    'V01',
    '도구 자체의 raw hex 0건',
    `${rawHexHits.length}건 발견: ${rawHexHits.slice(0, 5).join(', ')}`,
  );

  // V02: inline style raw px 0건
  const inlinePxHits: string[] = [];
  for (const file of componentFiles) {
    const m = file.content.match(/style=\{[^}]*\b\d+px\b/g);
    if (m && m.length > 0) inlinePxHits.push(`${rel(file.path)} (${m.length}건)`);
  }
  record(
    inlinePxHits.length === 0,
    'V02',
    'inline style raw px 0건',
    inlinePxHits.join(', '),
  );

  // V03: 도구 자체의 Tailwind raw spacing 0건 (gap-N/p-N/m-N/mt-N 등이 v-*
  // 토큰 형태가 아니라 Tailwind 기본 scale 로 들어가 있으면 Vapor spacing
  // 스케일과 어긋난다). border-N / outline-N / w-N 같은 width 속성은 spacing
  // 토큰이 아니므로 제외한다.
  const v03Pattern =
    /(?:^|[^a-zA-Z0-9_-])(?:gap|p|m|px|py|mx|my|mt|mr|mb|ml|pt|pr|pb|pl)-[0-9](?:\.[0-9]+)?(?:[^a-zA-Z0-9_-]|$)/;
  const v03Hits: string[] = [];
  for (const file of componentFiles) {
    const lines = file.content.split('\n');
    for (const [idx, line] of lines.entries()) {
      if (/^\s*\/\/|^\s*\*|\*\s/.test(line)) continue;
      if (v03Pattern.test(line)) v03Hits.push(`${rel(file.path)}:${idx + 1}`);
    }
  }
  record(
    v03Hits.length === 0,
    'V03',
    'Vapor v-* spacing tokens (raw gap-N/p-N/m-N 등 0건)',
    `${v03Hits.length}건 발견: ${v03Hits.slice(0, 5).join(', ')}`,
  );

  // S01: filename sanitize 함수가 parser + writeGen 양쪽에서 호출되는지
  const parserSrc = await readFile(join(ROOT, 'src/agent/responseParser.ts'), 'utf8');
  const writeGenSrc = await readFile(join(ROOT, 'server/validation/writeGeneratedFiles.ts'), 'utf8');
  const s01 =
    /export function isSafeArtifactFilename/.test(parserSrc) &&
    /isSafeArtifactFilename\(/.test(parserSrc) &&
    /isSafeArtifactFilename\(/.test(writeGenSrc);
  record(
    s01,
    'S01',
    'filename sanitize 함수 export + parser/writeGen 양쪽 호출',
    'isSafeArtifactFilename 호출 누락',
  );

  // T02: validationProxy 의 concurrent guard
  const proxySrc = await readFile(join(ROOT, 'server/validation/validationProxy.ts'), 'utf8');
  record(
    /maxConcurrentRuns/.test(proxySrc) && /\b429\b/.test(proxySrc),
    'T02',
    '동시 validation cap + 429',
    'maxConcurrentRuns/429 누락',
  );

  // T03: TTL sweep export
  const tempWsSrc = await readFile(join(ROOT, 'server/validation/createTempWorkspace.ts'), 'utf8');
  record(
    /sweepStaleTempWorkspaces/.test(tempWsSrc),
    'T03',
    'TTL sweep 함수 export',
    'sweepStaleTempWorkspaces 미구현',
  );

  // T04: SIGKILL escalation
  const runCmdSrc = await readFile(join(ROOT, 'server/validation/runCommand.ts'), 'utf8');
  record(
    /SIGKILL/.test(runCmdSrc) && /SIGKILL_ESCALATION_DELAY_MS/.test(runCmdSrc),
    'T04',
    'SIGTERM → SIGKILL escalation',
    'SIGKILL 누락',
  );

  // U01: validation 탭 한국어
  const previewPanelSrc = await readFile(join(ROOT, 'src/components/chat/PreviewPanel.tsx'), 'utf8');
  record(
    /validation:\s*'검증'/.test(previewPanelSrc),
    'U01',
    '검증 탭 한국어 레이블',
    "validation: '검증' 누락",
  );

  // U06: repair chain attempts UI
  const chatScreenSrc = await readFile(join(ROOT, 'src/components/chat/ChatScreen.tsx'), 'utf8');
  record(
    /MAX_REPAIR_ATTEMPTS_PER_CHAIN/.test(chatScreenSrc) && /repairChainAttempts/.test(chatScreenSrc),
    'U06',
    'repair chain attempts UI cap',
    'repairChainAttempts state 누락',
  );

  // U07: ThemeToggle 가 Vapor useTheme 을 사용
  const themeToggleSrc = await readFile(join(ROOT, 'src/components/chat/ThemeToggle.tsx'), 'utf8');
  record(
    /useTheme/.test(themeToggleSrc) && /setTheme/.test(themeToggleSrc),
    'U07',
    'ThemeToggle Vapor useTheme 연결',
    'useTheme 누락',
  );

  // V05: token gate hsl/oklch
  const tokenUsageSrc = await readFile(join(ROOT, 'src/agent/tokenUsage.ts'), 'utf8');
  record(
    /hsl/.test(tokenUsageSrc) && /oklch/.test(tokenUsageSrc) && /NAMED_COLOR_KEYWORDS/.test(tokenUsageSrc),
    'V05',
    'token regex hsl/oklch/named',
    'hsl/oklch/named 미커버',
  );

  // V06: ESLint config 에 vapor boundary 규칙 존재
  const eslintSrc = await readFile(join(ROOT, 'eslint.config.js'), 'utf8');
  record(
    /no-restricted-imports/.test(eslintSrc) && /@vapor-ui\/core/.test(eslintSrc),
    'V06',
    'ESLint vapor boundary 강제',
    'no-restricted-imports rule 누락',
  );

  // A03: iframe title
  record(
    /iframe[\s\S]{0,200}?title=/.test(previewPanelSrc),
    'A03',
    'Canvas iframe title',
    '누락',
  );

  // A04: tab/tabpanel ARIA pair
  record(
    /role="tab"[\s\S]*?aria-controls/.test(previewPanelSrc) &&
      /role: 'tabpanel'/.test(previewPanelSrc) &&
      /'aria-labelledby'/.test(previewPanelSrc),
    'A04',
    'tab/tabpanel ARIA 페어',
    'aria-controls/role=tabpanel 누락',
  );

  // A05: prefers-reduced-motion
  const convoSrc = await readFile(join(ROOT, 'src/components/chat/ConversationView.tsx'), 'utf8');
  record(
    /prefers-reduced-motion/.test(convoSrc),
    'A05',
    'prefers-reduced-motion 대응',
    '누락',
  );

  // S03: API key 클라이언트 노출 차단 — src/ 안에 process.env.DEEPSEEK 또는
  // import.meta.env.DEEPSEEK 가 없어야 함
  const allSrc = await readTextRecursive(join(ROOT, 'src'), ['.ts', '.tsx'], ['.test.']);
  const apiKeyLeaks = allSrc.filter((f) =>
    /(?:process\.env|import\.meta\.env)\.DEEPSEEK_API_KEY/.test(f.content),
  );
  record(
    apiKeyLeaks.length === 0,
    'S03',
    'API key 클라이언트 노출 차단',
    apiKeyLeaks.map((f) => rel(f.path)).join(', '),
  );

  // S04: postMessage origin allowlist
  record(
    /event\.origin\s*!==\s*previewOrigin/.test(previewPanelSrc),
    'S04',
    'postMessage origin allowlist',
    '누락',
  );

  // Summary
  const passed = verdicts.filter((v) => v.status === 'pass').length;
  const failed = verdicts.filter((v) => v.status === 'fail');
  const stamp = new Date().toISOString();
  const summary = {
    timestamp: stamp,
    total: verdicts.length,
    passed,
    failed: failed.length,
    verdicts,
  };
  if (failed.length === 0) {
    process.stdout.write(`✔ All ${passed} static metrics PASS\n`);
    for (const v of verdicts) process.stdout.write(`  PASS ${v.id} — ${v.label}\n`);
    process.exit(0);
  }
  process.stdout.write(`✘ ${failed.length} of ${verdicts.length} static metrics FAILED\n`);
  for (const v of verdicts) {
    const marker = v.status === 'pass' ? 'PASS' : 'FAIL';
    process.stdout.write(`  ${marker} ${v.id} — ${v.label}`);
    if (v.detail) process.stdout.write(`  | ${v.detail}`);
    process.stdout.write('\n');
  }
  // JSON for CI consumption
  process.stdout.write(`\n${JSON.stringify(summary, null, 2)}\n`);
  process.exit(1);
}

run().catch((err) => {
  process.stderr.write(`run-metrics-check failed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(2);
});
