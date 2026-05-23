import { spawn } from 'node:child_process';

export type CommandResult = {
  exitCode: number;
  output: string;
  durationMs: number;
};

export function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = 30_000,
): Promise<CommandResult> {
  const startedAt = performance.now();

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolve({
        exitCode: 124,
        output: `${output}\nCommand timed out after ${timeoutMs}ms.`,
        durationMs: Math.round(performance.now() - startedAt),
      });
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on('close', (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode: exitCode ?? 1,
        output: output.trim(),
        durationMs: Math.round(performance.now() - startedAt),
      });
    });
  });
}
