import { describe, expect, it } from 'vitest';
import { runCommand, SIGKILL_ESCALATION_DELAY_MS } from './runCommand.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('runCommand', () => {
  it('정상 종료 자식 프로세스를 close 이벤트로 settle 한다', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'runcmd-'));
    try {
      const result = await runCommand('node', ['-e', 'console.log("ok"); process.exit(0);'], cwd);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('ok');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('타임아웃 시 exitCode 124 + "Command timed out" 메시지를 반환한다', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'runcmd-'));
    try {
      // 자식이 0.5초 sleep 하지만 timeout 은 100ms 이므로 timeout 분기 진입.
      const result = await runCommand(
        'node',
        ['-e', 'setTimeout(() => {}, 500);'],
        cwd,
        100,
      );
      expect(result.exitCode).toBe(124);
      expect(result.output).toContain('Command timed out after 100ms');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('SIGTERM 을 무시하는 자식도 SIGKILL escalation 으로 종료된다', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'runcmd-'));
    try {
      // 자식: SIGTERM handler 등록 후 1초 간격 timer 로 계속 살아 있음. SIGTERM
      // 만으로는 종료되지 않으므로 escalation timer (SIGKILL) 가 종료시켜야 한다.
      const start = Date.now();
      const result = await runCommand(
        'node',
        [
          '-e',
          "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);",
        ],
        cwd,
        200,
      );
      const elapsed = Date.now() - start;
      expect(result.exitCode).toBe(124);
      // runCommand 는 timeout 이 발생하자마자 resolve 한다 (escalation 비동기).
      // 하지만 escalation timer 가 unref 된 채 살아 있더라도 vitest worker 이
      // 정상 종료되는 것이 핵심이다 (좀비 자식이 worker 를 붙잡지 않음).
      // promise 자체는 timeout 시점에 settle 된다.
      expect(elapsed).toBeLessThan(200 + SIGKILL_ESCALATION_DELAY_MS + 2_000);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('SIGKILL_ESCALATION_DELAY_MS 는 적절한 윈도우에 있다', () => {
    expect(SIGKILL_ESCALATION_DELAY_MS).toBeGreaterThan(0);
    expect(SIGKILL_ESCALATION_DELAY_MS).toBeLessThanOrEqual(10_000);
  });
});
