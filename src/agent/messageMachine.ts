import type { MessageStatus } from './types';

/**
 * 메시지 상태머신.
 *
 * 전이: `idle → streaming → done | error | cancelled`
 *
 * `queued` 상태는 두지 않는다. 이 화면은 단일 활성 스트림만 다루므로
 * 큐 상태는 도달 불가능한 dead state 가 된다. 종료 상태(done/error/cancelled)
 * 에서의 복구는 새 메시지를 생성하는 방식(소비자 책임)으로 처리한다.
 */
export type MachineEvent =
  | { type: 'send' }
  | { type: 'token' }
  | { type: 'done' }
  | { type: 'error' }
  | { type: 'cancel' };

/** 종료 상태 여부. */
export function isTerminal(status: MessageStatus): boolean {
  return status === 'done' || status === 'error' || status === 'cancelled';
}

/**
 * 순수 전이 함수 `(state, event) → state`.
 * 정의되지 않은 전이는 현재 상태를 유지한다.
 */
export function messageReducer(
  state: MessageStatus,
  event: MachineEvent,
): MessageStatus {
  switch (state) {
    case 'idle':
      return event.type === 'send' ? 'streaming' : state;

    case 'streaming':
      switch (event.type) {
        case 'token':
          return 'streaming';
        case 'done':
          return 'done';
        case 'error':
          return 'error';
        case 'cancel':
          return 'cancelled';
        default:
          return state;
      }

    // 종료 상태 — 추가 전이 없음. 복구는 새 메시지로.
    case 'done':
    case 'error':
    case 'cancelled':
      return state;

    default:
      return state;
  }
}
