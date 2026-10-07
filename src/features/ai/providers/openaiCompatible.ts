import { SuiteLensError } from '../../../netsuite/errors';
import type { AiProviderInfo } from '../catalog';
import type { AiResult } from '../types';
import type { AiProvider, AiStreamParams } from './types';

/** Retries for network errors, 408/409/429 and 5xx before the stream starts. */
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;
const RETRY_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

/**
 * Providers that speak the OpenAI Chat Completions format (OpenAI, Gemini, Groq, DeepSeek,
 * Qwen, Kimi, GLM, MiniMax, OpenRouter; ADR 0043). Plain `fetch` + server-sent events from the
 * background worker; the endpoint comes from the fixed catalog, never from the user or the
 * request. The key is only placed in the `Authorization` header. Only model, messages, the
 * output-token cap and stream flags are sent.
 */
export function createOpenAiCompatibleProvider(info: AiProviderInfo): AiProvider {
  return {
    kind: info.id,
    requiresKey: true,
    stream: (params) => streamChat(info, params),
  };
}

type ChatChunk = {
  choices?: {
    delta?: { content?: unknown };
    finish_reason?: unknown;
    usage?: unknown;
  }[];
  usage?: unknown;
  error?: unknown;
};

async function streamChat(info: AiProviderInfo, params: AiStreamParams): Promise<AiResult> {
  const { apiKey, model, maxTokens, system, messages, signal, onDelta } = params;
  if (!apiKey) {
    throw new SuiteLensError('AI_NOT_CONFIGURED', 'No AI API key is available.');
  }
  if (signal.aborted) throw cancelled();

  const body = {
    model,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages.map((message) => ({ role: message.role, content: message.content })),
    ],
    stream: true,
    [info.maxTokensField ?? 'max_tokens']: maxTokens,
    ...(info.streamUsage ? { stream_options: { include_usage: true } } : {}),
  };

  try {
    const response = await fetchWithRetry(
      `${info.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...info.requestHeaders,
        },
        body: JSON.stringify(body),
        credentials: 'omit',
        signal,
      },
      signal,
    );
    if (!response.ok) throw statusError(response.status);
    if (!response.body) throw new SuiteLensError('AI_PROVIDER_ERROR', 'Empty AI response.');

    let text = '';
    let finishReason: string | undefined;
    let usage: { inputTokens: number; outputTokens: number } | undefined;
    for await (const data of readServerSentEvents(response.body, signal)) {
      if (data === '[DONE]') break;
      let chunk: ChatChunk;
      try {
        chunk = JSON.parse(data) as ChatChunk;
      } catch {
        continue;
      }
      if (chunk.error) {
        throw new SuiteLensError(
          'AI_PROVIDER_ERROR',
          'The AI provider returned an error. Retry in a moment.',
          'stream error',
        );
      }
      const choice = chunk.choices?.[0];
      const delta = choice?.delta?.content;
      if (typeof delta === 'string' && delta) {
        text += delta;
        onDelta(delta);
      }
      if (typeof choice?.finish_reason === 'string') finishReason = choice.finish_reason;
      // Usage: top level (OpenAI style) or inside the last choice (Moonshot style).
      usage = parseUsage(chunk.usage) ?? parseUsage(choice?.usage) ?? usage;
    }
    if (signal.aborted) throw cancelled();

    const stopReason = mapFinishReason(finishReason);
    return {
      text,
      // Providers that report no usage still count against the local daily limit (estimate).
      usage: usage ?? {
        inputTokens: estimate(system + messages.map((m) => m.content).join('')),
        outputTokens: estimate(text),
      },
      ...(stopReason ? { stopReason } : {}),
    };
  } catch (err) {
    if (signal.aborted) throw cancelled();
    if (err instanceof SuiteLensError) throw err;
    throw new SuiteLensError(
      'AI_PROVIDER_ERROR',
      'Cannot reach the AI provider. Check your connection and the site permission.',
      err instanceof Error ? err.name : 'connection error',
    );
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response | undefined;
    try {
      response = await fetch(url, init);
    } catch (err) {
      if (signal.aborted || attempt >= MAX_RETRIES) throw err;
    }
    if (response && (response.ok || !RETRY_STATUSES.has(response.status))) return response;
    if (response && attempt >= MAX_RETRIES) return response;
    await response?.body?.cancel().catch(() => undefined);
    await delay(RETRY_BASE_MS * 2 ** attempt, signal);
  }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(cancelled());
      },
      { once: true },
    );
  });
}

/** Yields the `data:` payload of each server-sent event; comments and other fields are skipped. */
export async function* readServerSentEvents(
  stream: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let data: string[] = [];
  try {
    for (;;) {
      if (signal.aborted) return;
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = done ? '' : (lines.pop() ?? '');
      for (const line of done ? [...lines, ''] : lines) {
        if (line === '') {
          if (data.length) yield data.join('\n');
          data = [];
        } else if (line.startsWith('data:')) {
          data.push(line.slice(5).replace(/^ /, ''));
        }
      }
      if (done) return;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function parseUsage(value: unknown): { inputTokens: number; outputTokens: number } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const usage = value as { prompt_tokens?: unknown; completion_tokens?: unknown };
  if (typeof usage.prompt_tokens !== 'number' && typeof usage.completion_tokens !== 'number') {
    return undefined;
  }
  return {
    inputTokens: nonNegative(usage.prompt_tokens),
    outputTokens: nonNegative(usage.completion_tokens),
  };
}

/** Maps OpenAI finish reasons to the stop reasons the UI understands (Anthropic names). */
function mapFinishReason(reason: string | undefined): string | undefined {
  switch (reason) {
    case undefined:
      return undefined;
    case 'stop':
      return 'end_turn';
    case 'length':
      return 'max_tokens';
    case 'content_filter':
      return 'refusal';
    default:
      return reason;
  }
}

function nonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function estimate(text: string): number {
  return Math.ceil(text.length / 4);
}

function cancelled(): SuiteLensError {
  return new SuiteLensError('CANCELLED', 'The AI request was cancelled.');
}

/**
 * HTTP status to a safe `SuiteLensError`. The response body is never read or forwarded (it
 * could echo request content); the detail carries only the status.
 */
export function statusError(status: number): SuiteLensError {
  const message =
    status === 401
      ? 'The AI provider rejected the API key. Check the key in Settings.'
      : status === 402
        ? 'The AI provider account has no credit left.'
        : status === 403
          ? 'The API key is not allowed to use this model or feature.'
          : status === 404
            ? 'The AI model was not found. Check the model ID in Settings.'
            : status === 429
              ? 'The AI provider rate limit was reached. Wait a moment and retry.'
              : status === 400 || status === 413 || status === 422
                ? 'The AI provider rejected the request. Check the model ID and the size of the request.'
                : 'The AI provider returned an error. Retry in a moment.';
  return new SuiteLensError('AI_PROVIDER_ERROR', message, `HTTP ${status}`);
}
