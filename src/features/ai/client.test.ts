import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { AI_PORT_NAME } from '../../netsuite/bridge/protocol';
import { SuiteLensError } from '../../netsuite/errors';
import { streamAi } from './client';
import type { AiRequest } from './types';

type Listener<T extends unknown[]> = (...args: T) => void;

function createPort() {
  const messageListeners: Listener<[unknown]>[] = [];
  const disconnectListeners: Listener<[]>[] = [];
  const port = {
    name: AI_PORT_NAME,
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onMessage: { addListener: (fn: Listener<[unknown]>) => messageListeners.push(fn) },
    onDisconnect: { addListener: (fn: Listener<[]>) => disconnectListeners.push(fn) },
  };
  return {
    port,
    serverSend: (message: unknown) => messageListeners.forEach((fn) => fn(message)),
    serverDisconnect: () => disconnectListeners.forEach((fn) => fn()),
  };
}

const request: AiRequest = {
  feature: 'explainError',
  system: 'system',
  messages: [{ role: 'user', content: 'Why?' }],
};

let current: ReturnType<typeof createPort>;
const connect = vi.fn();

beforeEach(() => {
  current = createPort();
  connect.mockReset().mockImplementation(() => current.port);
  Object.assign(fakeBrowser.runtime, { connect });
});

describe('streamAi', () => {
  it('sends start, streams deltas and resolves with text and usage', async () => {
    const onDelta = vi.fn();
    const promise = streamAi(request, { onDelta });

    expect(connect).toHaveBeenCalledWith({ name: AI_PORT_NAME });
    expect(current.port.postMessage).toHaveBeenCalledWith({ type: 'start', request });
    current.serverSend({ type: 'delta', text: 'Because ' });
    current.serverSend({ type: 'delta', text: 'reasons.' });
    current.serverSend({
      type: 'done',
      usage: { inputTokens: 5, outputTokens: 3 },
      stopReason: 'end_turn',
    });

    await expect(promise).resolves.toEqual({
      text: 'Because reasons.',
      usage: { inputTokens: 5, outputTokens: 3 },
      stopReason: 'end_turn',
    });
    expect(onDelta.mock.calls).toEqual([['Because '], ['reasons.']]);
    expect(current.port.disconnect).toHaveBeenCalled();
  });

  it('rejects with the server error', async () => {
    const promise = streamAi(request);
    current.serverSend({
      type: 'error',
      error: { code: 'AI_LOCKED', message: 'Unlock your key.' },
    });
    const error = await promise.catch((err: unknown) => err);
    expect(error).toBeInstanceOf(SuiteLensError);
    expect(error).toMatchObject({ code: 'AI_LOCKED', message: 'Unlock your key.' });
  });

  it('rejects invalid server messages', async () => {
    const promise = streamAi(request);
    current.serverSend({ type: 'delta', text: 42 });
    await expect(promise).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(current.port.disconnect).toHaveBeenCalled();
  });

  it('cancels on abort', async () => {
    const controller = new AbortController();
    const onDelta = vi.fn();
    const promise = streamAi(request, { signal: controller.signal, onDelta });
    current.serverSend({ type: 'delta', text: 'partial' });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(current.port.postMessage).toHaveBeenLastCalledWith({ type: 'cancel' });
    expect(current.port.disconnect).toHaveBeenCalled();
    current.serverSend({ type: 'delta', text: 'late' });
    expect(onDelta).toHaveBeenCalledTimes(1);
  });

  it('does not connect when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(streamAi(request, { signal: controller.signal })).rejects.toMatchObject({
      code: 'CANCELLED',
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it('rejects on unexpected disconnect', async () => {
    const promise = streamAi(request);
    current.serverDisconnect();
    await expect(promise).rejects.toMatchObject({ code: 'AI_PROVIDER_ERROR' });
  });

  it('ignores disconnect after done', async () => {
    const promise = streamAi(request);
    current.serverSend({ type: 'done', usage: { inputTokens: 1, outputTokens: 1 } });
    current.serverDisconnect();
    await expect(promise).resolves.toEqual({
      text: '',
      usage: { inputTokens: 1, outputTokens: 1 },
    });
  });
});
