import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type TempWorkspace = {
  path: string;
  cleanup: () => Promise<void>;
};

/**
 * 새 validation run 이 임시 작업공간을 만들기 직전에 호출되는 TTL sweep
 * 윈도우. 이 시점이 지난 prefix 매칭 dir 은 crash / SIGKILL / process restart
 * 등으로 cleanup gate 가 실행되지 못한 leftover 로 간주하고 강제 제거한다.
 *
 * 기본 60 분; 환경변수 `VAPOR_TEMP_WORKSPACE_TTL_MS` 로 override.
 */
export const DEFAULT_TEMP_WORKSPACE_TTL_MS = 60 * 60 * 1000;
const TEMP_WORKSPACE_PREFIXES = ['vapor-generated-', 'vapor-preview-'] as const;

function readTtl(): number {
  const raw = process.env.VAPOR_TEMP_WORKSPACE_TTL_MS;
  if (!raw) return DEFAULT_TEMP_WORKSPACE_TTL_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TEMP_WORKSPACE_TTL_MS;
}

/**
 * tmpdir 내부의 stale temp workspace 를 비동기로 제거한다. 실패해도 throw
 * 하지 않으며 (호출자가 정상 작업 path 를 진행할 수 있도록), 결과는 sweep
 * 된 디렉터리 수를 resolve. 실제 race 가 있어도 `rm(..., force: true)` 가
 * 안전하게 처리한다.
 */
export async function sweepStaleTempWorkspaces(
  ttlMs: number = readTtl(),
  baseDir: string = tmpdir(),
): Promise<number> {
  let removed = 0;
  let entries: string[];
  try {
    entries = await readdir(baseDir);
  } catch {
    return 0;
  }
  const cutoff = Date.now() - ttlMs;
  await Promise.all(
    entries
      .filter((name) => TEMP_WORKSPACE_PREFIXES.some((prefix) => name.startsWith(prefix)))
      .map(async (name) => {
        const fullPath = join(baseDir, name);
        try {
          const info = await stat(fullPath);
          if (info.mtimeMs > cutoff) return;
          await rm(fullPath, { recursive: true, force: true });
          removed++;
        } catch {
          // 이미 다른 프로세스가 제거했거나 권한 문제 — 정상 무시.
        }
      }),
  );
  return removed;
}

export async function createTempWorkspace(): Promise<TempWorkspace> {
  // TTL sweep 은 새 workspace 가 만들어지기 직전에 1회 실행. fire-and-forget
  // 으로 호출하면 race 가 발생할 수 있으므로 await 하지만 결과는 무시한다.
  // 비용은 tmpdir 의 vapor-* 항목 개수에 비례 (수 ms 수준).
  try {
    await sweepStaleTempWorkspaces();
  } catch {
    // sweep 실패가 새 run 을 막아서는 안 된다.
  }
  const path = await mkdtemp(join(tmpdir(), 'vapor-generated-'));
  let cleaned = false;

  return {
    path,
    cleanup: async () => {
      if (cleaned) return;
      cleaned = true;
      await rm(path, { recursive: true, force: true });
    },
  };
}
