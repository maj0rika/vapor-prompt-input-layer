import type { IncomingMessage, ServerResponse } from 'node:http';
import { validateGeneratedArtifact } from './validateGeneratedArtifact.ts';

type ValidationProxyRequest = {
  markdown?: unknown;
};

export async function handleGeneratedValidation(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  const parsed = await readRequestBody(req);
  if (!parsed.ok) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }

  const markdown = normalizeMarkdown(parsed.value);
  if (!markdown.ok) {
    sendJson(res, 400, { error: markdown.error });
    return;
  }

  try {
    const result = await validateGeneratedArtifact(markdown.value);
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Generated validation failed.',
    });
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
      if (body.length > 220_000) {
        req.destroy();
        resolve({ ok: false, error: 'Validation request body is too large.' });
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

function normalizeMarkdown(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  const request = value as ValidationProxyRequest;
  if (typeof request.markdown !== 'string' || !request.markdown.trim()) {
    return { ok: false, error: 'Artifact markdown is required.' };
  }
  return { ok: true, value: request.markdown };
}

function sendJson(res: ServerResponse, status: number, payload: object) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}
