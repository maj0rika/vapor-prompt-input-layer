import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_TEMP_WORKSPACE_TTL_MS,
  createTempWorkspace,
  sweepStaleTempWorkspaces,
} from './createTempWorkspace.ts';

const HOUR_MS = 60 * 60 * 1000;

describe('sweepStaleTempWorkspaces (T03)', () => {
  let scratch: string;
  beforeEach(async () => {
    scratch = await mkdtemp(join(tmpdir(), 'sweep-test-'));
  });
  afterEach(async () => {
    await rm(scratch, { recursive: true, force: true });
  });

  it('TTL 을 넘긴 vapor-generated- prefix dir 만 제거하고 fresh 는 유지한다', async () => {
    const stale = join(scratch, 'vapor-generated-old');
    const fresh = join(scratch, 'vapor-generated-fresh');
    const unrelated = join(scratch, 'other-something');
    await mkdir(stale);
    await mkdir(fresh);
    await mkdir(unrelated);
    await writeFile(join(stale, 'file'), 'old');
    await writeFile(join(fresh, 'file'), 'fresh');
    await writeFile(join(unrelated, 'file'), 'other');

    // stale 의 mtime 을 2시간 전으로 만든다 (TTL=1h cutoff)
    const past = new Date(Date.now() - 2 * HOUR_MS);
    await utimes(stale, past, past);
    await utimes(join(stale, 'file'), past, past);

    const removed = await sweepStaleTempWorkspaces(HOUR_MS, scratch);

    expect(removed).toBe(1);
    const after = await readdir(scratch);
    expect(after).not.toContain('vapor-generated-old');
    expect(after).toContain('vapor-generated-fresh');
    expect(after).toContain('other-something');
  });

  it('vapor-preview- prefix dir 도 동일 정책으로 sweep 한다', async () => {
    const stale = join(scratch, 'vapor-preview-old');
    await mkdir(stale);
    const past = new Date(Date.now() - 3 * HOUR_MS);
    await utimes(stale, past, past);

    const removed = await sweepStaleTempWorkspaces(HOUR_MS, scratch);

    expect(removed).toBe(1);
    expect(await readdir(scratch)).not.toContain('vapor-preview-old');
  });

  it('baseDir 가 존재하지 않으면 throw 하지 않고 0 을 반환한다', async () => {
    const removed = await sweepStaleTempWorkspaces(HOUR_MS, join(scratch, 'does-not-exist'));
    expect(removed).toBe(0);
  });

  it('DEFAULT_TEMP_WORKSPACE_TTL_MS 가 1시간 (60 * 60 * 1000) 이다', () => {
    expect(DEFAULT_TEMP_WORKSPACE_TTL_MS).toBe(HOUR_MS);
  });
});

describe('createTempWorkspace 가 sweep 을 트리거한다', () => {
  it('새 workspace 가 생성되고 cleanup 으로 제거된다 (sweep 은 묵묵히 실행)', async () => {
    const ws = await createTempWorkspace();
    expect(ws.path).toContain('vapor-generated-');
    // cleanup 호출
    await ws.cleanup();
    // 멱등성: 다시 호출해도 throw 하지 않음
    await ws.cleanup();
  });
});
