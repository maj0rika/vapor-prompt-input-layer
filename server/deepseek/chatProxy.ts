import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildDeepSeekPayload } from '../../src/agent/promptBuilder';
import type { AgentMode, AgentRequest, MessageAttachment } from '../../src/agent/types';

type DeepSeekProxyRequest = {
  text?: unknown;
  mode?: unknown;
  dataSources?: unknown;
  attachments?: unknown;
  previousArtifactSource?: unknown;
  validationResult?: unknown;
  repairIntent?: unknown;
};

type FailedGate = 'typecheck' | 'unit' | 'runtime' | 'axe' | 'token' | 'cleanup';
const FAILED_GATES: readonly FailedGate[] = [
  'typecheck',
  'unit',
  'runtime',
  'axe',
  'token',
  'cleanup',
];
/** previousArtifactSource 서버측 안전 상한. promptBuilder 가 추가로 8192 까지 자른다. */
const MAX_PREVIOUS_ARTIFACT_BYTES = 64 * 1024;

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';

export async function handleDeepSeekChat(
  req: IncomingMessage,
  res: ServerResponse,
  apiKey?: string,
) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  if (!apiKey) {
    sendJson(res, 500, { error: 'DEEPSEEK_API_KEY is missing in .env.local.' });
    return;
  }

  const parsed = await readRequestBody(req);
  if (!parsed.ok) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }

  const normalized = normalizeAgentRequest(parsed.value);
  if (!normalized.ok) {
    sendJson(res, 400, { error: normalized.error });
    return;
  }

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const upstream = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildDeepSeekPayload(normalized.value)),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      const body = await upstream.text();
      sendJson(res, upstream.status, {
        error: summarizeDeepSeekError(upstream.status, body),
      });
      return;
    }

    if (!upstream.body) {
      sendJson(res, 502, { error: 'DeepSeek returned an empty stream.' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (res.destroyed) break;
        res.write(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }

    res.end();
  } catch (err) {
    if (!res.headersSent && !isAbortError(err)) {
      sendJson(res, 502, { error: 'DeepSeek request failed.' });
    }
    if (!res.destroyed) res.end();
  }
}

function readRequestBody(
  req: IncomingMessage,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > 160_000) {
        req.destroy();
        resolve({ ok: false, error: 'Request body is too large.' });
      }
    });
    req.on('end', () => {
      try {
        resolve({ ok: true, value: JSON.parse(body) });
      } catch {
        resolve({ ok: false, error: 'Invalid JSON request body.' });
      }
    });
    req.on('error', () => resolve({ ok: false, error: 'Request read failed.' }));
  });
}

/** Exported for unit testing — keep in sync with handleDeepSeekChat. */
export function normalizeAgentRequest(
  value: unknown,
): { ok: true; value: AgentRequest } | { ok: false; error: string } {
  const request = value as DeepSeekProxyRequest;
  const text = typeof request.text === 'string' ? request.text.trim() : '';
  if (!text) return { ok: false, error: 'Message text is required.' };

  return {
    ok: true,
    value: {
      text,
      mode: normalizeMode(request.mode),
      dataSources: Array.isArray(request.dataSources)
        ? request.dataSources.filter((source): source is string => typeof source === 'string')
        : [],
      attachments: normalizeAttachments(request.attachments),
      // Fix-with-Agent: 실패 게이트·이전 artifact·validation 상세를 prompt builder 가
      // 볼 수 있도록 그대로 전달한다. 이게 빠지면 모델이 "어떤 게이트가 실패했는지"
      // 다시 묻는 회귀가 발생한다.
      previousArtifactSource: normalizePreviousArtifactSource(request.previousArtifactSource),
      validationResult: request.validationResult,
      repairIntent: normalizeRepairIntent(request.repairIntent),
    },
  };
}

function normalizePreviousArtifactSource(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value.length > MAX_PREVIOUS_ARTIFACT_BYTES
    ? value.slice(0, MAX_PREVIOUS_ARTIFACT_BYTES)
    : value;
}

function normalizeRepairIntent(value: unknown): AgentRequest['repairIntent'] {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as {
    failedGates?: unknown;
    maxAttempts?: unknown;
    parentRunId?: unknown;
  };

  const failedGates = Array.isArray(raw.failedGates)
    ? raw.failedGates.filter((gate): gate is FailedGate =>
        typeof gate === 'string' && (FAILED_GATES as readonly string[]).includes(gate),
      )
    : [];
  if (failedGates.length === 0) return undefined;

  const maxAttempts =
    typeof raw.maxAttempts === 'number' && Number.isFinite(raw.maxAttempts) && raw.maxAttempts > 0
      ? raw.maxAttempts
      : 1;

  return {
    failedGates,
    maxAttempts,
    parentRunId: typeof raw.parentRunId === 'string' ? raw.parentRunId : undefined,
  };
}

function normalizeMode(value: unknown): AgentMode {
  if (
    value === 'component' ||
    value === 'token-sync' ||
    value === 'a11y-audit' ||
    value === 'story-test'
  ) {
    return value;
  }
  return 'component';
}

function normalizeAttachments(value: unknown): MessageAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((attachment) => {
    if (!isAttachment(attachment)) return [];
    return [
      {
        fileName: attachment.fileName,
        size: attachment.size,
        kind: attachment.kind,
        contentText: trimAttachmentText(attachment.contentText),
        truncated: attachment.truncated,
      },
    ];
  });
}

function isAttachment(value: unknown): value is MessageAttachment {
  if (!value || typeof value !== 'object') return false;
  const attachment = value as Partial<MessageAttachment>;
  return (
    typeof attachment.fileName === 'string' &&
    typeof attachment.size === 'number' &&
    Number.isFinite(attachment.size)
  );
}

function trimAttachmentText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (value.length <= 16_000) return value;
  return `${value.slice(0, 16_000)}\n\n[trimmed]`;
}

function summarizeDeepSeekError(status: number, body: string): string {
  if (!body) return `DeepSeek request failed (${status}).`;
  try {
    const payload = JSON.parse(body) as { error?: { message?: string } };
    return payload.error?.message || `DeepSeek request failed (${status}).`;
  } catch {
    return `DeepSeek request failed (${status}).`;
  }
}

function sendJson(res: ServerResponse, status: number, payload: object) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}
