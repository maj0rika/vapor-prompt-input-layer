import { describe, it, expect } from 'vitest';
import { messageReducer, isTerminal, type MachineEvent } from './messageMachine';
import type { MessageStatus } from './types';

const ALL_STATES: MessageStatus[] = [
  'idle',
  'streaming',
  'done',
  'error',
  'cancelled',
];

const ALL_EVENTS: MachineEvent[] = [
  { type: 'send' },
  { type: 'token' },
  { type: 'done' },
  { type: 'error' },
  { type: 'cancel' },
];

describe('messageReducer', () => {
  it('idle 에서 send 로 streaming 에 진입한다', () => {
    expect(messageReducer('idle', { type: 'send' })).toBe('streaming');
  });

  it('idle 은 send 외의 이벤트에 그대로 머문다', () => {
    expect(messageReducer('idle', { type: 'token' })).toBe('idle');
  });

  it('streaming 에서 token 은 streaming 을 유지한다', () => {
    expect(messageReducer('streaming', { type: 'token' })).toBe('streaming');
  });

  it('streaming 에서 done/error/cancel 로 각 종료 상태에 전이한다', () => {
    expect(messageReducer('streaming', { type: 'done' })).toBe('done');
    expect(messageReducer('streaming', { type: 'error' })).toBe('error');
    expect(messageReducer('streaming', { type: 'cancel' })).toBe('cancelled');
  });

  it('종료 상태는 어떤 이벤트에도 그대로 머문다', () => {
    for (const terminal of ['done', 'error', 'cancelled'] as MessageStatus[]) {
      for (const event of ALL_EVENTS) {
        expect(messageReducer(terminal, event)).toBe(terminal);
      }
    }
  });

  it('어떤 (상태, 이벤트) 조합도 queued 같은 미지 상태를 만들지 않는다', () => {
    for (const state of ALL_STATES) {
      for (const event of ALL_EVENTS) {
        const next = messageReducer(state, event);
        expect(ALL_STATES).toContain(next);
        expect(next).not.toBe('queued');
      }
    }
  });
});

describe('isTerminal', () => {
  it('done/error/cancelled 만 종료 상태로 본다', () => {
    expect(isTerminal('done')).toBe(true);
    expect(isTerminal('error')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('idle')).toBe(false);
    expect(isTerminal('streaming')).toBe(false);
  });
});
