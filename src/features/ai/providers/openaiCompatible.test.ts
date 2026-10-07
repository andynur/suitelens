import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuiteLensError } from '../../../netsuite/errors';
import { AI_PROVIDER_CATALOG } from '../catalog';
import { createOpenAiCompatibleProvider, readServerSentEvents } from './openaiCompatible';
import type { AiStreamParams } from './types';
import { commandCodeProvider } from './commandCode';

const KEY = 'sk-test-secret-0123456789';
const fetchMock = vi.fn<typeof fetch>();

function sse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

const event = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;

function params(overrides: Partial<AiStreamParams> = {}): AiStreamParams {
  return {
    feature: 'suiteql',
    apiKey: KEY,
    model: 'test-model',
    maxTokens: 1000,
    system: 'You are helpful.',
    messages: [{ role: 'user', content: 'Hello' }],
    signal: new AbortController().signal,
    onDelta: () => undefined,
    ...overrides,
  };
}

function requestOf(call = 0) {
  const [url, init] = fetchMock.mock.calls[call]!;
  return {
    url: String(url),
    headers: init?.headers as Record<string, string>,
    body: JSON.parse(String(init?.body)) as Record<string, unknown>,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('OpenAI-compatible provider', () => {
  it('streams Gemini text and usage using the official endpoint and Bearer key', async () => {
    fetchMock.mockResolvedValue(
      sse([
        event({ choices: [{ delta: { content: 'SELECT 1' }, finish_reason: 'stop' }] }),
        event({
          choices: [],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 20,
            completion_tokens_details: { reasoning_tokens: 17 },
          },
        }),
        'data: [DONE]\n\n',
      ]),
    );
    const result = await createOpenAiCompatibleProvider(AI_PROVIDER_CATALOG.gemini).stream(
      params({ model: AI_PROVIDER_CATALOG.gemini.defaultModel }),
    );
    expect(result).toMatchObject({
      text: 'SELECT 1',
      usage: { inputTokens: 12, outputTokens: 20 },
    });
    expect(requestOf().url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
    expect(requestOf().headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(requestOf().headers).not.toHaveProperty('x-cmd-zdr');
    expect(requestOf().body).toMatchObject({
      model: 'gemini-3.8-flash',
      max_tokens: 1000,
      stream_options: { include_usage: true },
    });
  });

  it.each([
    ['deepseek/deepseek-v4-flash', 'max_tokens'],
    ['openai/gpt-5', 'max_completion_tokens'],
  ])('routes Command Code %s through Chat Completions with ZDR', async (model, cap) => {
    fetchMock.mockResolvedValue(
      sse([
        event({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }),
        event({ choices: [], usage: { prompt_tokens: 9, completion_tokens: 1 } }),
      ]),
    );
    const result = await commandCodeProvider.stream(params({ model }));
    expect(result).toMatchObject({ text: 'ok', usage: { inputTokens: 9, outputTokens: 1 } });
    const request = requestOf();
    expect(request.url).toBe('https://api.commandcode.ai/provider/v1/chat/completions');
    expect(request.headers).toMatchObject({ Authorization: `Bearer ${KEY}`, 'x-cmd-zdr': '1' });
    expect(request.body[cap]).toBe(1000);
  });

  it('never retries Command Code without ZDR after rejection', async () => {
    fetchMock.mockResolvedValue(new Response('private provider error', { status: 422 }));
    await expect(commandCodeProvider.stream(params())).rejects.toMatchObject({
      code: 'AI_PROVIDER_ERROR',
      detail: 'HTTP 422',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestOf().headers['x-cmd-zdr']).toBe('1');
  });

  it('rejects a Command Code decision model before sending a request', async () => {
    await expect(
      commandCodeProvider.stream(params({ model: 'typesafe/jev' })),
    ).rejects.toMatchObject({
      code: 'AI_PROVIDER_ERROR',
      message: expect.stringContaining('cannot generate text'),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('streams deltas and reports usage and stop reason', async () => {
    fetchMock.mockResolvedValue(
      sse([
        event({ choices: [{ delta: { role: 'assistant', content: '' } }] }),
        // A chunk split across reads, plus a keep-alive comment.
        'data: {"choices":[{"delta":{"content":"SEL',
        'ECT 1"}}]}\n\n: keep-alive\n\n',
        event({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
        event({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 3 } }),
        'data: [DONE]\n\n',
      ]),
    );
    const deltas: string[] = [];
    const provider = createOpenAiCompatibleProvider(AI_PROVIDER_CATALOG.deepseek);
    const result = await provider.stream(params({ onDelta: (text) => deltas.push(text) }));

    expect(deltas).toEqual(['SELECT 1']);
    expect(result).toEqual({
      text: 'SELECT 1',
      usage: { inputTokens: 12, outputTokens: 3 },
      stopReason: 'end_turn',
    });
    const request = requestOf();
    expect(request.url).toBe('https://api.deepseek.com/chat/completions');
    expect(request.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(request.body).toEqual({
      model: 'test-model',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
      ],
      stream: true,
      max_tokens: 1000,
      stream_options: { include_usage: true },
    });
  });

  it('uses each provider endpoint and max-tokens field', async () => {
    fetchMock.mockImplementation(async () => sse(['data: [DONE]\n\n']));
    await createOpenAiCompatibleProvider(AI_PROVIDER_CATALOG.openai).stream(params());
    await createOpenAiCompatibleProvider(AI_PROVIDER_CATALOG.moonshot).stream(params());

    const openai = requestOf(0);
    expect(openai.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(openai.body.max_completion_tokens).toBe(1000);
    expect(openai.body).not.toHaveProperty('max_tokens');

    const moonshot = requestOf(1);
    expect(moonshot.url).toBe('https://api.moonshot.ai/v1/chat/completions');
    expect(moonshot.body).not.toHaveProperty('stream_options');
  });

  it('reads usage from the last choice and estimates it when missing', async () => {
    fetchMock.mockResolvedValueOnce(
      sse([
        event({
          choices: [
            {
              delta: { content: 'Hi' },
              finish_reason: 'length',
              usage: { prompt_tokens: 7, completion_tokens: 1 },
            },
          ],
        }),
      ]),
    );
    const provider = createOpenAiCompatibleProvider(AI_PROVIDER_CATALOG.moonshot);
    expect(await provider.stream(params())).toEqual({
      text: 'Hi',
      usage: { inputTokens: 7, outputTokens: 1 },
      stopReason: 'max_tokens',
    });

    fetchMock.mockResolvedValueOnce(
      sse([event({ choices: [{ delta: { content: 'abcdefgh' } }] })]),
    );
    const estimated = await provider.stream(params());
    expect(estimated.usage).toEqual({ inputTokens: 6, outputTokens: 2 });
  });

  it('maps content filtering to a refusal', async () => {
    fetchMock.mockResolvedValue(
      sse([event({ choices: [{ delta: {}, finish_reason: 'content_filter' }] })]),
    );
    const result = await createOpenAiCompatibleProvider(AI_PROVIDER_CATALOG.qwen).stream(params());
    expect(result.stopReason).toBe('refusal');
  });

  it('maps HTTP errors without forwarding the response body', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: `bad key ${KEY}` } }), { status: 401 }),
    );
    const error = await createOpenAiCompatibleProvider(AI_PROVIDER_CATALOG.groq)
      .stream(params())
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(SuiteLensError);
    expect((error as SuiteLensError).code).toBe('AI_PROVIDER_ERROR');
    expect((error as SuiteLensError).message).toMatch(/rejected the API key/);
    expect(JSON.stringify((error as SuiteLensError).toShape())).not.toContain(KEY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries rate limits before the stream starts', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(sse([event({ choices: [{ delta: { content: 'ok' } }] })]));
    const pending = createOpenAiCompatibleProvider(AI_PROVIDER_CATALOG.gemini).stream(params());
    await vi.runAllTimersAsync();
    expect((await pending).text).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails on an error object inside the stream', async () => {
    fetchMock.mockResolvedValue(sse([event({ error: { message: 'overloaded' } })]));
    await expect(
      createOpenAiCompatibleProvider(AI_PROVIDER_CATALOG.openrouter).stream(params()),
    ).rejects.toMatchObject({ code: 'AI_PROVIDER_ERROR', detail: 'stream error' });
  });

  it('reports cancellation and a missing key', async () => {
    const controller = new AbortController();
    controller.abort();
    const provider = createOpenAiCompatibleProvider(AI_PROVIDER_CATALOG.zhipu);
    await expect(provider.stream(params({ signal: controller.signal }))).rejects.toMatchObject({
      code: 'CANCELLED',
    });
    await expect(provider.stream(params({ apiKey: undefined }))).rejects.toMatchObject({
      code: 'AI_NOT_CONFIGURED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a network failure to a connection error', async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const pending = createOpenAiCompatibleProvider(AI_PROVIDER_CATALOG.minimax)
      .stream(params())
      .catch((err: unknown) => err);
    await vi.runAllTimersAsync();
    expect(await pending).toMatchObject({ code: 'AI_PROVIDER_ERROR', detail: 'TypeError' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('readServerSentEvents', () => {
  it('joins multi-line data and flushes the last event without a blank line', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: x\r\ndata: a\r\ndata: b\r\n\r\ndata: c'));
        controller.close();
      },
    });
    const events: string[] = [];
    for await (const data of readServerSentEvents(stream, new AbortController().signal)) {
      events.push(data);
    }
    expect(events).toEqual(['a\nb', 'c']);
  });
});
