import { useCallback, useEffect, useRef, useState } from 'react';
import { isTerminal } from '../../agent';
import type {
  AgentClient,
  AgentRequest,
  ChatMessage,
  PriorTurn,
  VerifiedSampleRun,
} from '../../agent';

/** 멀티턴 컨텍스트 cap. promptBuilder/chatProxy 도 동일 cap 으로 한 번 더 자른다. */
const MAX_PRIOR_TURNS = 20;

export type UseAgentStreamResult = {
  messages: ChatMessage[];
  isStreaming: boolean;
  send: (request: AgentRequest) => void;
  /** 모델 호출 없이 deterministic fixture 를 동일 artifact 경로에 삽입한다. */
  loadSampleRun: (sample: VerifiedSampleRun) => void;
  /** 해당 어시스턴트 메시지를 직전 user 메시지로 다시 생성한다 (재시도). */
  regenerate: (assistantId: string) => void;
  cancel: () => void;
  /** 진행 중인 스트림을 abort 하고 대화를 비워 EmptyState 로 되돌린다. */
  reset: () => void;
};

/**
 * AgentClient 스트림을 소비하는 훅.
 *
 * ## Teardown 계약 (AgentClient 참조)
 * - send 마다 `AbortController` 를 하나 생성·소유한다.
 * - 새 send 또는 컴포넌트 언마운트 시 직전 컨트롤러를 abort 한다.
 * - 언마운트 이후에는 어떤 상태도 갱신하지 않는다 (`mountedRef` 가드).
 *
 * 이로써 언마운트 중 스트리밍이 진행 중이어도 타이머·제너레이터가 정리되고,
 * 언마운트된 컴포넌트에 setState 가 호출되지 않는다.
 */
export function useAgentStream(client: AgentClient): UseAgentStreamResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // send 안에서 closure 가 stale 한 messages 를 잡지 않도록 ref 로 항상 최신 보관.
  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const patchMessage = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id ? { ...message, ...patch } : message,
        ),
      );
    },
    [],
  );

  const runStream = useCallback(
    async (request: AgentRequest, assistantId: string, signal: AbortSignal) => {
      let text = '';
      let draft = '';
      let artifactSource: string | undefined;
      try {
        for await (const event of client.sendMessage(request, signal)) {
          if (!mountedRef.current) return;
          switch (event.type) {
            case 'token':
              text += event.value;
              patchMessage(assistantId, { text });
              break;
            case 'draft':
              draft = event.replace ? event.value : draft + event.value;
              artifactSource = event.source ?? artifactSource;
              patchMessage(assistantId, {
                draft,
                artifactSource,
              });
              break;
            case 'done':
              patchMessage(assistantId, { status: 'done' });
              break;
            case 'error':
              patchMessage(assistantId, {
                status: 'error',
                errorMessage: event.message,
              });
              break;
          }
        }
      } finally {
        if (mountedRef.current) {
          setIsStreaming(false);
          // done/error 없이 루프가 끝났고 abort 되었다면 cancelled 로 마감.
          if (signal.aborted) {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId && message.status === 'streaming'
                  ? { ...message, status: 'cancelled' }
                  : message,
              ),
            );
          }
        }
      }
    },
    [client, patchMessage],
  );

  const send = useCallback(
    (request: AgentRequest) => {
      // 직전 스트림이 남아 있으면 정리한다.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // 멀티턴: 현재까지의 대화에서 text 가 있는 종료 메시지를 prior turns 로 묶는다.
      // 진행 중인 streaming 메시지는 컨텍스트로 의미가 없으므로 제외한다.
      const priorTurns: PriorTurn[] = messagesRef.current
        .filter(
          (message) =>
            message.text.trim().length > 0 && isTerminal(message.status),
        )
        .slice(-MAX_PRIOR_TURNS)
        .map((message) => ({ role: message.role, content: message.text }));
      const requestWithHistory: AgentRequest = {
        ...request,
        priorTurns:
          (request.priorTurns?.length ?? 0) > 0
            ? request.priorTurns
            : priorTurns.length > 0
              ? priorTurns
              : undefined,
      };

      const now = Date.now();
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: request.text,
        status: 'done',
        createdAt: now,
        attachments: request.attachments,
        request,
      };
      const assistantId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        text: '',
        status: 'streaming',
        createdAt: now,
        // workspace contract(특히 token-sync 분기)는 request.mode 에 의존한다.
        request,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);
      void runStream(requestWithHistory, assistantId, controller.signal);
    },
    [runStream],
  );

  const loadSampleRun = useCallback((sample: VerifiedSampleRun) => {
    abortRef.current?.abort();
    abortRef.current = null;

    const now = Date.now();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: sample.request.text,
      status: 'done',
      createdAt: now,
      attachments: sample.request.attachments,
      request: sample.request,
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: sample.assistantText,
      status: 'done',
      createdAt: now,
      draft: sample.draft,
      artifactSource: sample.artifactSource,
      artifactProvenance: sample.artifactProvenance,
      // workspace contract(특히 token-sync 분기)는 request.mode 에 의존한다.
      request: sample.request,
    };

    setIsStreaming(false);
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
  }, []);

  const regenerate = useCallback(
    (assistantId: string) => {
      const index = messages.findIndex((m) => m.id === assistantId);
      if (index < 1) return;
      const userMessage = messages[index - 1];
      if (userMessage.role !== 'user') return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // 직전 응답을 자리에서 초기화하고 같은 id 로 다시 스트리밍한다.
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
              ...message,
              text: '',
              status: 'streaming',
              createdAt: Date.now(),
              draft: undefined,
              artifactSource: undefined,
              errorMessage: undefined,
              }
            : message,
        ),
      );
      // regenerate 도 멀티턴: 같은 user 메시지가 직전이라도, 그 이전의 대화는
      // 모델 컨텍스트로 함께 전달한다 (재생성 ≠ 새 대화).
      const priorContextSource = messages.slice(0, index - 1);
      const priorTurns: PriorTurn[] = priorContextSource
        .filter(
          (message) =>
            message.text.trim().length > 0 && isTerminal(message.status),
        )
        .slice(-MAX_PRIOR_TURNS)
        .map((message) => ({ role: message.role, content: message.text }));
      const baseRequest = userMessage.request ?? { text: userMessage.text };
      const requestWithHistory: AgentRequest = {
        ...baseRequest,
        priorTurns: priorTurns.length > 0 ? priorTurns : undefined,
      };

      setIsStreaming(true);
      void runStream(requestWithHistory, assistantId, controller.signal);
    },
    [messages, runStream],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (mountedRef.current) {
      setIsStreaming(false);
      setMessages([]);
    }
  }, []);

  return { messages, isStreaming, send, loadSampleRun, regenerate, cancel, reset };
}
