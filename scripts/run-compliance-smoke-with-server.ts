/**
 * Wraps compliance-smoke.ts with automatic Vite dev server lifecycle.
 *
 * 1. Starts `vite dev` on port 5180
 * 2. Waits for HTTP 200
 * 3. Runs scripts/compliance-smoke.ts
 * 4. Kills dev server
 * 5. Exits with smoke exit code
 *
 * Usage: npx tsx scripts/run-compliance-smoke-with-server.ts
 */
import { spawn, execSync } from 'node:child_process';
import { request } from 'node:http';

const PORT = 5180;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PROJECT_ROOT = process.cwd();

function waitForServer(
  url: string,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolvePromise, reject) => {
    const check = () => {
      const req = request(url, (res) => {
        res.resume();
        resolvePromise();
      });
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Server at ${url} did not respond within ${timeoutMs}ms`));
          return;
        }
        setTimeout(check, 500);
      });
      req.end();
    };
    check();
  });
}

async function main() {
  console.log('[smoke-wrapper] Starting Vite dev server...');
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
    shell: true,
  });

  // Pipe dev server output so it's visible
  server.stdout.pipe(process.stdout);
  server.stderr.pipe(process.stderr);

  const cleanup = () => {
    if (server.exitCode === null) server.kill();
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(1); });
  process.on('SIGTERM', () => { cleanup(); process.exit(1); });

  try {
    await waitForServer(BASE_URL);
    console.log('[smoke-wrapper] Dev server ready. Running compliance smoke...');
  } catch (e) {
    console.error('[smoke-wrapper]', e instanceof Error ? e.message : e);
    server.kill();
    process.exit(1);
  }

  let exitCode = 0;
  try {
    execSync('npx tsx scripts/compliance-smoke.ts', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
  } catch (e: unknown) {
    exitCode = (e as { status?: number }).status ?? 1;
  } finally {
    server.kill();
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[smoke-wrapper]', err);
  process.exit(1);
});
