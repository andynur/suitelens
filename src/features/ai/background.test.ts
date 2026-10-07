import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { AI_PORT_NAME, type AiPortServerMessage } from '../../netsuite/bridge/protocol';
import { SuiteLensError } from '../../netsuite/errors';
import { DEFAULT_FEATURES, type FeatureId } from '../../shared/features';
import { DEFAULT_AI_SETTINGS, updateSettings } from '../../shared/storage/settings';
import type { AiProvider, AiStreamParams } from './providers/types';
import type { AiRequest } from './types';
import { getAiUsageToday } from './usage';

const mocks = vi.hoisted(() => ({
  getUnlockedAiKey: vi.fn<() => Promise<string | undefined>>(),
  getAiKeyInfo: vi.fn(),
  provider: {
    kind: 'anthropic',
    requiresKey: true,
    stream: vi.fn(),
  } as { kind: 'anthropic' | 'fixture'; requiresKey: boolean; stream: ReturnType<typeof vi.fn> },
}));

vi.mock('../../shared/storage/aiSecret', () => ({
  getUnlockedAiKey: mocks.getUnlockedAiKey,
  getAiKeyInfo: mocks.getAiKeyInfo,
}));
vi.mock('./providers', () => ({
  resolveAiProvider: vi.fn(async () => mocks.provider as unknown as AiProvider),
}));

const { registerAiPort, handleAiPort } = await import('./background');

type Listener<T extends unknown[]> = (...args: T) => void;

function createPort(sender: Record<string, unknown> = extensionSender()) {
  const messageListeners: Listener<[unknown]>[] = [];
  const disconnectListeners: Listener<[]>[] = [];
  const posted: AiPortServerMessage[] = [];
  const port = {
    name: AI_PORT_NAME,
    sender,
    postMessage: vi.fn((message: AiPortServerMessage) => {
      posted.push(message);
    }),
    disconnect: vi.fn(),
    onMessage: { addListener: (fn: Listener<[unknown]>) => messageListeners.push(fn) },
    onDisconnect: { addListener: (fn: Listener<[]>) => disconnectListeners.push(fn) },
  };
  return {
    port,
    posted,
    send: (message: unknown) => messageListeners.forEach((fn) => fn(message)),
    closeFromClient: () => disconnectListeners.forEach((fn) => fn()),
  };
}

function extensionSender() {
  return { id: fakeBrowser.runtime.id, url: fakeBrowser.runtime.getURL('/sidepanel.html') };
}

const request: AiRequest = {
  feature: 'suiteql',
  system: 'system prompt',
  messages: [{ role: 'user', content: 'question' }],
};

async function settle(posted: AiPortServerMessage[]) {
  await vi.waitFor(() => {
    expect(posted.some((m) => m.type === 'done' || m.type === 'error')).toBe(true);
  });
  return posted.at(-1)!;
}

function start(port: ReturnType<typeof createPort>, req: unknown = request) {
  handleAiPort(port.port as never);
  port.send({ type: 'start', request: req });
}

beforeEach(() => {
  mocks.getUnlockedAiKey.mockReset().mockResolvedValue('sk-ant-secret');
  mocks.getAiKeyInfo.mockReset().mockResolvedValue({ stored: 'encrypted', unlocked: true });
  mocks.provider.kind = 'anthropic';
  mocks.provider.requiresKey = true;
  mocks.provider.stream.mockReset().mockImplementation(async (params: AiStreamParams) => {
    params.onDelta('Hello ');
    params.onDelta('world');
    return {
      text: 'Hello world',
      usage: { inputTokens: 10, outputTokens: 4 },
      stopReason: 'end_turn',
    };
  });
});

describe('registerAiPort', () => {
  function captureListener() {
    let listener: ((port: unknown) => void) | undefined;
    Object.assign(fakeBrowser.runtime, {
      onConnect: { addListener: (fn: (port: unknown) => void) => (listener = fn) },
    });
    registerAiPort();
    return listener!;
  }

  it('accepts extension pages', async () => {
    const listener = captureListener();
    const port = createPort();
    listener(port.port);
    port.send({ type: 'start', request });
    expect((await settle(port.posted)).type).toBe('done');
    expect(port.port.disconnect).not.toHaveBeenCalled();
  });

  it.each([
    ['another extension', { id: 'other', url: 'chrome-extension://other/sidepanel.html' }],
    ['a web page', { id: fakeBrowser.runtime.id, url: 'https://1234.app.netsuite.com/app' }],
    [
      'a content script',
      { ...extensionSender(), tab: { id: 3 }, url: 'https://1234.app.netsuite.com/app' },
    ],
    ['an empty sender', {}],
  ])('rejects %s', (_label, sender) => {
    const listener = captureListener();
    const port = createPort(sender as never);
    listener(port.port);
    port.send({ type: 'start', request });
    expect(port.port.disconnect).toHaveBeenCalled();
    expect(mocks.provider.stream).not.toHaveBeenCalled();
  });

  it('accepts a full-page extension view opened as a tab', async () => {
    const listener = captureListener();
    const port = createPort({ ...extensionSender(), tab: { id: 3 } } as never);
    listener(port.port);
    port.send({ type: 'start', request });
    expect((await settle(port.posted)).type).toBe('done');
    expect(port.port.disconnect).not.toHaveBeenCalled();
  });

  it('ignores ports with other names', () => {
    const listener = captureListener();
    const port = createPort();
    port.port.name = 'other';
    listener(port.port);
    expect(port.port.disconnect).not.toHaveBeenCalled();
  });
});

describe('handleAiPort', () => {
  it('streams deltas, posts done and records usage', async () => {
    await updateSettings({
      ai: { ...DEFAULT_AI_SETTINGS, model: 'claude-x', maxTokensPerRequest: 2048 },
    });
    const port = createPort();
    start(port);
    const last = await settle(port.posted);

    expect(port.posted).toEqual([
      { type: 'delta', text: 'Hello ' },
      { type: 'delta', text: 'world' },
      { type: 'done', usage: { inputTokens: 10, outputTokens: 4 }, stopReason: 'end_turn' },
    ]);
    expect(last.type).toBe('done');
    const params = mocks.provider.stream.mock.calls[0]![0] as AiStreamParams;
    expect(params).toMatchObject({
      feature: 'suiteql',
      apiKey: 'sk-ant-secret',
      model: 'claude-x',
      maxTokens: 2048,
      system: 'system prompt',
      messages: request.messages,
    });
    expect((await getAiUsageToday()).tokens).toBe(14);
  });

  it('ignores a second start and invalid messages', async () => {
    const port = createPort();
    start(port);
    port.send({ type: 'start', request });
    port.send({ type: 'bogus' });
    await settle(port.posted);
    expect(mocks.provider.stream).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid request without calling the provider', async () => {
    const port = createPort();
    start(port, { feature: 'nope', system: '', messages: [] });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(port.posted).toEqual([]);
    expect(mocks.provider.stream).not.toHaveBeenCalled();
  });

  it('reports AI_NOT_CONFIGURED when no key is stored', async () => {
    mocks.getUnlockedAiKey.mockResolvedValue(undefined);
    mocks.getAiKeyInfo.mockResolvedValue({ stored: 'none', unlocked: false });
    const port = createPort();
    start(port);
    expect(await settle(port.posted)).toMatchObject({
      type: 'error',
      error: { code: 'AI_NOT_CONFIGURED' },
    });
    expect(mocks.provider.stream).not.toHaveBeenCalled();
  });

  it('reports AI_LOCKED when the stored key is locked', async () => {
    mocks.getUnlockedAiKey.mockResolvedValue(undefined);
    mocks.getAiKeyInfo.mockResolvedValue({ stored: 'encrypted', unlocked: false });
    const port = createPort();
    start(port);
    expect(await settle(port.posted)).toMatchObject({
      type: 'error',
      error: { code: 'AI_LOCKED' },
    });
  });

  it('needs no key for the fixture provider', async () => {
    mocks.provider.kind = 'fixture';
    mocks.provider.requiresKey = false;
    mocks.getUnlockedAiKey.mockResolvedValue(undefined);
    const port = createPort();
    start(port);
    expect((await settle(port.posted)).type).toBe('done');
    expect(mocks.getUnlockedAiKey).not.toHaveBeenCalled();
  });

  it('blocks requests once the daily limit is reached', async () => {
    await updateSettings({ ai: { ...DEFAULT_AI_SETTINGS, maxTokensPerDay: 10 } });
    const first = createPort();
    start(first);
    expect((await settle(first.posted)).type).toBe('done');

    const second = createPort();
    start(second);
    expect(await settle(second.posted)).toMatchObject({ error: { code: 'AI_LIMIT_REACHED' } });
    expect(mocks.provider.stream).toHaveBeenCalledTimes(1);
  });

  it('rejects when AI Assist is turned off', async () => {
    const features: Record<FeatureId, boolean> = { ...DEFAULT_FEATURES, aiAssist: false };
    await updateSettings({ features });
    const port = createPort();
    start(port);
    expect(await settle(port.posted)).toMatchObject({ error: { code: 'UNSUPPORTED' } });
  });

  it('turns a refusal into an error after recording usage', async () => {
    mocks.provider.stream.mockResolvedValue({
      text: '',
      usage: { inputTokens: 3, outputTokens: 1 },
      stopReason: 'refusal',
    });
    const port = createPort();
    start(port);
    expect(await settle(port.posted)).toMatchObject({ error: { code: 'AI_PROVIDER_ERROR' } });
    expect((await getAiUsageToday()).tokens).toBe(4);
  });

  it('forwards provider SuiteLensErrors and hides unexpected error messages', async () => {
    mocks.provider.stream.mockRejectedValueOnce(
      new SuiteLensError('AI_PROVIDER_ERROR', 'Rate limited', 'HTTP 429'),
    );
    const a = createPort();
    start(a);
    expect(await settle(a.posted)).toEqual({
      type: 'error',
      error: { code: 'AI_PROVIDER_ERROR', message: 'Rate limited', detail: 'HTTP 429' },
    });

    mocks.provider.stream.mockRejectedValueOnce(new Error('payload text leaked'));
    const b = createPort();
    start(b);
    const last = await settle(b.posted);
    expect(JSON.stringify(last)).not.toContain('payload text');
  });

  function hangingProvider() {
    let seen: AbortSignal | undefined;
    mocks.provider.stream.mockImplementation(
      (params: AiStreamParams) =>
        new Promise((_resolve, reject) => {
          seen = params.signal;
          params.onDelta('partial');
          params.signal.addEventListener('abort', () =>
            reject(new SuiteLensError('CANCELLED', 'cancelled')),
          );
        }),
    );
    return () => seen;
  }

  it('aborts on cancel', async () => {
    const signal = hangingProvider();
    const port = createPort();
    start(port);
    await vi.waitFor(() => expect(signal()).toBeDefined());
    port.send({ type: 'cancel' });
    expect(signal()!.aborted).toBe(true);
    expect(await settle(port.posted)).toMatchObject({ error: { code: 'CANCELLED' } });
  });

  it('aborts on disconnect and stops posting', async () => {
    const signal = hangingProvider();
    const port = createPort();
    start(port);
    await vi.waitFor(() => expect(signal()).toBeDefined());
    port.closeFromClient();
    expect(signal()!.aborted).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(port.posted).toEqual([{ type: 'delta', text: 'partial' }]);
  });
});
