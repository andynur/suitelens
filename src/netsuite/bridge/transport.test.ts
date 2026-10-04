import { describe, expect, it, vi } from 'vitest';
import { createFakeWindow } from '../../test/fakeWindow';
import { BRIDGE_REQUEST_SOURCE } from './protocol';
import { createBridgeClient, installBridgeListener } from './transport';

const NONCE = 'a'.repeat(32);
const OTHER = 'b'.repeat(32);

describe('bridge transport', () => {
  it('round-trips an allow-listed operation', async () => {
    const { win } = createFakeWindow();
    installBridgeListener(win, NONCE, async () => ({ ok: true, data: { requireAvailable: true } }));
    const client = createBridgeClient(win, NONCE);
    await expect(client.call({ op: 'ping' })).resolves.toEqual({ requireAvailable: true });
    client.dispose();
  });

  it('propagates bridge errors as LoupeError', async () => {
    const { win } = createFakeWindow();
    installBridgeListener(win, NONCE, async () => ({
      ok: false,
      error: { code: 'REQUIRE_UNAVAILABLE', message: 'x' },
    }));
    await expect(createBridgeClient(win, NONCE).call({ op: 'ping' })).rejects.toMatchObject({
      code: 'REQUIRE_UNAVAILABLE',
    });
  });

  it('rejects responses that do not match the operation schema', async () => {
    const { win } = createFakeWindow();
    installBridgeListener(win, NONCE, async () => ({ ok: true, data: { unexpected: 1 } }));
    await expect(createBridgeClient(win, NONCE).call({ op: 'ping' })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('ignores requests with a wrong nonce, origin, source or shape', async () => {
    const { win, dispatch } = createFakeWindow();
    const handle = vi.fn(async () => ({ ok: true as const, data: { requireAvailable: true } }));
    installBridgeListener(win, NONCE, handle);
    const valid = {
      source: BRIDGE_REQUEST_SOURCE,
      nonce: NONCE,
      id: 'req-1',
      payload: { op: 'ping' },
    };
    dispatch({ ...valid, nonce: OTHER });
    dispatch(valid, { origin: 'https://evil.example' });
    dispatch(valid, { source: {} });
    dispatch({ ...valid, payload: { op: 'eval', code: 'alert(1)' } });
    dispatch({ ...valid, payload: { op: 'runSuiteQL', queryId: 'custom', variantId: 'full' } });
    await new Promise((r) => setTimeout(r, 10));
    expect(handle).not.toHaveBeenCalled();
    dispatch(valid);
    await new Promise((r) => setTimeout(r, 10));
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('times out when nobody answers, and stops listening after uninstall', async () => {
    const { win, listeners } = createFakeWindow();
    const uninstall = installBridgeListener(win, OTHER, async () => ({ ok: true, data: {} }));
    const client = createBridgeClient(win, NONCE);
    await expect(client.call({ op: 'ping' }, 20)).rejects.toMatchObject({ code: 'TIMEOUT' });
    uninstall();
    client.dispose();
    expect(listeners.size).toBe(0);
  });
});
