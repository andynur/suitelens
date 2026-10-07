import Anthropic from '@anthropic-ai/sdk';
import type { AiProviderId } from '../catalog';
import { SuiteLensError } from '../../../netsuite/errors';
import type { AiResult } from '../types';
import type { AiProvider, AiStreamParams } from './types';

/** Retries for connection errors, 408/409/429 and 5xx before the stream starts. */
const MAX_RETRIES = 2;

/**
 * Anthropic provider through the official SDK (ADR 0041). Runs in the background worker, which
 * is a browser context, hence `dangerouslyAllowBrowser`. The key comes from secure storage
 * and is only placed in the request header by the SDK. Only model, max_tokens, system and
 * messages are sent; sampling and thinking parameters are left to the model defaults.
 */
type AnthropicProviderOptions = {
  kind: AiProviderId;
  /** Fixed extension configuration, never a page- or user-supplied endpoint. */
  baseURL?: string;
  defaultHeaders?: Readonly<Record<string, string>>;
};

export function createAnthropicProvider(options: AnthropicProviderOptions): AiProvider {
  return {
    kind: options.kind,
    requiresKey: true,
    stream: (params) => streamAnthropic(params, options),
  };
}

export const anthropicProvider = createAnthropicProvider({ kind: 'anthropic' });

async function streamAnthropic(
  params: AiStreamParams,
  options: AnthropicProviderOptions,
): Promise<AiResult> {
  const { apiKey, model, maxTokens, system, messages, signal, onDelta } = params;
  if (!apiKey) {
    throw new SuiteLensError('AI_NOT_CONFIGURED', 'No AI API key is available.');
  }
  if (signal.aborted) throw cancelled();
  try {
    const client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
      maxRetries: MAX_RETRIES,
      ...(options.baseURL ? { baseURL: options.baseURL } : {}),
      ...(options.defaultHeaders ? { defaultHeaders: options.defaultHeaders } : {}),
    });
    const stream = client.messages.stream(
      {
        model,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
      },
      { signal },
    );
    let text = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        text += event.delta.text;
        onDelta(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    return {
      text,
      usage: {
        inputTokens: nonNegative(final.usage?.input_tokens),
        outputTokens: nonNegative(final.usage?.output_tokens),
      },
      ...(final.stop_reason ? { stopReason: final.stop_reason } : {}),
    };
  } catch (err) {
    if (signal.aborted) throw cancelled();
    throw mapAnthropicError(err);
  }
}

function nonNegative(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function cancelled(): SuiteLensError {
  return new SuiteLensError('CANCELLED', 'The AI request was cancelled.');
}

/**
 * Maps SDK errors to safe `SuiteLensError`s. Provider messages are not forwarded (they could
 * echo request content); the detail carries only the HTTP status.
 */
export function mapAnthropicError(err: unknown): SuiteLensError {
  if (err instanceof SuiteLensError) return err;
  if (err instanceof Anthropic.APIUserAbortError) return cancelled();
  if (err instanceof Anthropic.AuthenticationError) {
    return providerError('The AI provider rejected the API key. Check the key in Settings.', err);
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return providerError('The API key is not allowed to use this model or feature.', err);
  }
  if (err instanceof Anthropic.NotFoundError) {
    return providerError('The AI model was not found. Check the model ID in Settings.', err);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return providerError('The AI provider rate limit was reached. Wait a moment and retry.', err);
  }
  if (err instanceof Anthropic.BadRequestError) {
    return providerError(
      'The AI provider rejected the request. Check the model ID and the size of the request.',
      err,
    );
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new SuiteLensError(
      'AI_PROVIDER_ERROR',
      'Cannot reach the AI provider. Check your connection and the site permission.',
      err instanceof Anthropic.APIConnectionTimeoutError ? 'timeout' : 'connection error',
    );
  }
  if (err instanceof Anthropic.APIError) {
    return providerError('The AI provider returned an error. Retry in a moment.', err);
  }
  return new SuiteLensError(
    'AI_PROVIDER_ERROR',
    'The AI request failed.',
    err instanceof Error ? err.name : undefined,
  );
}

function providerError(
  message: string,
  err: InstanceType<typeof Anthropic.APIError>,
): SuiteLensError {
  const status = typeof err.status === 'number' ? `HTTP ${err.status}` : 'no status';
  return new SuiteLensError('AI_PROVIDER_ERROR', message, status);
}
