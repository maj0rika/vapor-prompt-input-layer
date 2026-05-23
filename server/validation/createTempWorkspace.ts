import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type TempWorkspace = {
  path: string;
  cleanup: () => Promise<void>;
};

export async function createTempWorkspace(): Promise<TempWorkspace> {
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
