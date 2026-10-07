import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SuiteLensError } from '../../../netsuite/errors';
import type { AiStreamParams } from './types';

const sdk = vi.hoisted(() => {
  class APIError extends Error {
    readonly status: number | undefined;
    constructor(status: number | undefined, message = 'api error') {
      super(message);
      this.status = status;
    }
  }
  class APIUserAbortError extends APIError {
    constructor() {
      super(undefined, 'aborted');
    }
  }
  class APIConnectionError extends APIError {
    constructor() {
      super(undefined, 'connection');
    }
  }
  class APIConnectionTimeoutError extends APIConnectionError {}
  class BadRequestError extends APIError {}
  class AuthenticationError extends APIError {}
  class PermissionDeniedError extends APIError {}
  class NotFoundError extends APIError {}
  class RateLimitError extends APIError {}

  type FakeStream = {
    events: unknown[];
    final: unknown;
    error?: unknown;
  };
  const state: {
    next: FakeStream;
    constructorOptions: unknown[];
    streamCalls: { body: Record<string, unknown>; options: { signal?: AbortSignal } }[];
  } = {
    next: { events: [], final: {} },
    constructorOptions: [],
    streamCalls: [],
  };

  class Anthropic {
    static APIError = APIError;
    static APIUserAbortError = APIUserAbortError;
    static APIConnectionError = APIConnectionError;
    static APIConnectionTimeoutError = APIConnectionTimeoutError;
    static BadRequestError = BadRequestError;
    static AuthenticationError = AuthenticationError;
    static PermissionDeniedError = PermissionDeniedError;
    static NotFoundError = NotFoundError;
    static RateLimitError = RateLimitError;

    messages = {
      stream: (body: Record<string, unknown>, options: { signal?: AbortSignal }) => {
        state.streamCalls.push({ body, options });
        const current = state.next;
        return {
          async *[Symbol.asyncIterator]() {
            for (const event of current.events) {
              if (options.signal?.aborted) throw new APIUserAbortError();
              yield event;
            }
            if (current.error) throw current.error;
          },
          finalMessage: async () => current.final,
        };
      },
    };

    constructor(options: unknown) {
      state.constructorOptions.push(options);
    }
  }
  return { Anthropic, state };
});

vi.mock('@anthropic-ai/sdk', () => ({ default: sdk.Anthropic }));

const { anthropicProvider, mapAnthropicError } = await import('./anthropic');
const { commandCodeProvider } = await import('./commandCode');

function textDelta(text: string) {
  return { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } };
}

function params(overrides: Partial<AiStreamParams> = {}): AiStreamParams {
  return {
    feature: 'suiteql',
    apiKey: 'sk-ant-test-secret',
    model: 'claude-test',
    maxTokens: 1024,
    system: 'You write SuiteQL.',
    messages: [{ role: 'user', content: 'List customers' }],
    signal: new AbortController().signal,
    onDelta: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  sdk.state.next = { events: [], final: {} };
  sdk.state.constructorOptions = [];
  sdk.state.streamCalls = [];
});

describe('anthropicProvider', () => {
  it('routes Command Code Claude through Messages with ZDR and the same key', async () => {
    sdk.state.next = {
      events: [textDelta('Command answer')],
      final: { usage: { input_tokens: 12, output_tokens: 7 }, stop_reason: 'end_turn' },
    };
    const result = await commandCodeProvider.stream(params({ model: 'claude-sonnet-4-6' }));
    expect(result.text).toBe('Command answer');
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 7 });
    expect(sdk.state.constructorOptions[0]).toMatchObject({
      apiKey: 'sk-ant-test-secret',
      baseURL: 'https://api.commandcode.ai/provider',
      defaultHeaders: { 'x-cmd-zdr': '1' },
    });
    expect(sdk.state.streamCalls[0]!.body.model).toBe('claude-sonnet-4-6');
  });

  it('streams text deltas and returns usage and stop reason', async () => {
    sdk.state.next = {
      events: [
        { type: 'message_start' },
        textDelta('SELECT '),
        { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta' } },
        textDelta('id FROM customer'),
        { type: 'message_stop' },
      ],
      final: { usage: { input_tokens: 12, output_tokens: 7 }, stop_reason: 'end_turn' },
    };
    const onDelta = vi.fn();
    const result = await anthropicProvider.stream(params({ onDelta }));

    expect(result).toEqual({
      text: 'SELECT id FROM customer',
      usage: { inputTokens: 12, outputTokens: 7 },
      stopReason: 'end_turn',
    });
    expect(onDelta.mock.calls).toEqual([['SELECT '], ['id FROM customer']]);
  });

  it('sends only model, max_tokens, system and messages', async () => {
    const signal = new AbortController().signal;
    await anthropicProvider.stream(params({ signal }));

    expect(sdk.state.constructorOptions[0]).toMatchObject({
      apiKey: 'sk-ant-test-secret',
      dangerouslyAllowBrowser: true,
    });
    const call = sdk.state.streamCalls[0]!;
    expect(call.body).toEqual({
      model: 'claude-test',
      max_tokens: 1024,
      system: 'You write SuiteQL.',
      messages: [{ role: 'user', content: 'List customers' }],
    });
    expect(call.options.signal).toBe(signal);
  });

  it('omits an empty system prompt and tolerates missing usage', async () => {
    const result = await anthropicProvider.stream(params({ system: '' }));
    expect(sdk.state.streamCalls[0]!.body).not.toHaveProperty('system');
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(result).not.toHaveProperty('stopReason');
  });

  it('passes a refusal stop reason through', async () => {
    sdk.state.next = {
      events: [],
      final: { usage: { input_tokens: 5, output_tokens: 1 }, stop_reason: 'refusal' },
    };
    const result = await anthropicProvider.stream(params());
    expect(result.stopReason).toBe('refusal');
  });

  it('requires a key', async () => {
    await expect(anthropicProvider.stream(params({ apiKey: undefined }))).rejects.toMatchObject({
      code: 'AI_NOT_CONFIGURED',
    });
  });

  it('maps abort to CANCELLED', async () => {
    const controller = new AbortController();
    sdk.state.next = { events: [textDelta('a'), textDelta('b')], final: {} };
    const onDelta = vi.fn(() => controller.abort());
    await expect(
      anthropicProvider.stream(params({ signal: controller.signal, onDelta })),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(onDelta).toHaveBeenCalledTimes(1);
  });

  it('rejects immediately when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      anthropicProvider.stream(params({ signal: controller.signal })),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(sdk.state.streamCalls).toHaveLength(0);
  });

  it('maps SDK errors without leaking the key or provider message', async () => {
    sdk.state.next = {
      events: [],
      final: {},
      error: new sdk.Anthropic.AuthenticationError(401, 'invalid x-api-key sk-ant-test-secret'),
    };
    const error = await anthropicProvider.stream(params()).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(SuiteLensError);
    expect(error).toMatchObject({ code: 'AI_PROVIDER_ERROR', detail: 'HTTP 401' });
    expect(JSON.stringify((error as SuiteLensError).toShape())).not.toContain('sk-ant');
  });
});

describe('mapAnthropicError', () => {
  it.each([
    [new sdk.Anthropic.PermissionDeniedError(403), 'HTTP 403', /not allowed/],
    [new sdk.Anthropic.NotFoundError(404), 'HTTP 404', /model was not found/],
    [new sdk.Anthropic.RateLimitError(429), 'HTTP 429', /rate limit/],
    [new sdk.Anthropic.BadRequestError(400), 'HTTP 400', /rejected the request/],
    [new sdk.Anthropic.APIError(529), 'HTTP 529', /returned an error/],
    [new sdk.Anthropic.APIConnectionError(), 'connection error', /Cannot reach/],
    [new sdk.Anthropic.APIConnectionTimeoutError(), 'timeout', /Cannot reach/],
  ])('maps %o', (err, detail, message) => {
    const mapped = mapAnthropicError(err);
    expect(mapped.code).toBe('AI_PROVIDER_ERROR');
    expect(mapped.detail).toBe(detail);
    expect(mapped.message).toMatch(message);
  });

  it('maps user abort and unknown errors', () => {
    expect(mapAnthropicError(new sdk.Anthropic.APIUserAbortError()).code).toBe('CANCELLED');
    expect(mapAnthropicError(new TypeError('boom secret'))).toMatchObject({
      code: 'AI_PROVIDER_ERROR',
      message: 'The AI request failed.',
      detail: 'TypeError',
    });
    const own = new SuiteLensError('AI_LOCKED', 'locked');
    expect(mapAnthropicError(own)).toBe(own);
  });
});
