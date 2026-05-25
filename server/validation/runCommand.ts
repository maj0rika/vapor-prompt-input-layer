import { spawn } from 'node:child_process';

export type CommandResult = {
  exitCode: number;
  output: string;
  durationMs: number;
};

/**
 * SIGTERM 발송 후 자식 프로세스가 정상 종료를 무시할 때 SIGKILL 로 강제
 * 종료하기까지 대기하는 시간. Vitest 같이 worker thread 를 spawn 하는
 * 자식은 SIGTERM 만으로 즉시 끝나지 않을 수 있어, escalation 이 없으면
 * 좀비 worker 가 CPU 를 점유하고 다음 validation 을 오염시킨다.
 */
export const SIGKILL_ESCALATION_DELAY_MS = 2_000;

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
    let escalationTimer: ReturnType<typeof setTimeout> | undefined;
    const clearEscalation = () => {
      if (escalationTimer !== undefined) {
        clearTimeout(escalationTimer);
        escalationTimer = undefined;
      }
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      // 자식이 SIGTERM 을 무시하면 SIGKILL 로 escalation. close 가 먼저
      // 도달하면 clearEscalation 으로 취소된다.
      escalationTimer = setTimeout(() => {
        if (!child.killed) {
          try {
            child.kill('SIGKILL');
          } catch {
            // 자식이 이미 종료된 경우 무시.
          }
        }
      }, SIGKILL_ESCALATION_DELAY_MS);
      // unref 하지 않으면 escalation timer 가 event loop 를 붙잡아 테스트가
      // 끝나지 않는다.
      escalationTimer.unref?.();
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
      // SIGKILL escalation 이 예약된 상태에서 자식이 (SIGTERM 또는 다른 신호로)
      // 종료되면 escalation 을 취소한다.
      clearEscalation();
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
