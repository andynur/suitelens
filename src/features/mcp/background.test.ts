import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { randomUUID } from 'node:crypto';
import { DEFAULT_FEATURES } from '../../shared/features';
import { updateSettings } from '../../shared/storage/settings';
import { detectFromUrl } from '../../netsuite/context/detect';
import { McpStateSchema } from '../../netsuite/bridge/protocol';
import { registerMcpBridge } from './background';
import { MCP_STATE_KEY } from './state';

const url = 'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001';
const context = detectFromUrl(url)!;
const sender = () => ({ id: browser.runtime.id, url: browser.runtime.getURL('/sidepanel.html') });
let listener: (
  message: unknown,
  sender: unknown,
  reply: (value: unknown) => void,
) => boolean | undefined;
let updated: (id: number, info: { url?: string; status?: 'loading' | 'complete' }) => void;
let messages: ((message: unknown) => void)[];
let disconnected: (() => void)[];
let port: ReturnType<typeof browser.runtime.connectNative>;
const posted = vi.fn();
const forward = vi.fn();
async function control(action: string, rest = {}) {
  return new Promise((resolve) => {
    if (!listener({ type: 'suitelens:mcp', action, ...rest }, sender(), resolve)) resolve(false);
  });
}
async function state() {
  return McpStateSchema.parse((await browser.storage.session.get(MCP_STATE_KEY))[MCP_STATE_KEY]);
}

beforeEach(async () => {
  messages = [];
  disconnected = [];
  posted.mockReset();
  forward.mockReset();
  vi.spyOn(browser.runtime.onMessage, 'addListener').mockImplementation((fn) => {
    listener = fn as unknown as typeof listener;
  });
  vi.spyOn(browser.tabs.onUpdated, 'addListener').mockImplementation((fn) => {
    updated = (id, info) => fn(id, info, { id } as never);
  });
  vi.spyOn(browser.tabs, 'get').mockResolvedValue({ id: 7, url } as never);
  vi.spyOn(browser.permissions, 'contains').mockReturnValue(Promise.resolve(true) as never);
  port = {
    postMessage: posted,
    disconnect: vi.fn(),
    onMessage: { addListener: (fn: (v: unknown) => void) => messages.push(fn) },
    onDisconnect: { addListener: (fn: () => void) => disconnected.push(fn) },
  } as unknown as typeof port;
  vi.spyOn(browser.permissions.onRemoved, 'addListener').mockImplementation(() => {});
  vi.spyOn(browser.runtime, 'connectNative').mockReturnValue(port);
  forward.mockImplementation(async (_id, request) => ({
    ok: true,
    data: request.op === 'getPageContext' ? context : undefined,
  }));
  await updateSettings({ features: { ...DEFAULT_FEATURES, mcpBridge: true } });
  registerMcpBridge(forward);
});

describe('MCP background boundary', () => {
  it('rejects web/content/foreign senders and malformed controls', () => {
    for (const untrusted of [
      {},
      { id: browser.runtime.id, url },
      { id: 'foreign', url: sender().url },
    ])
      expect(
        listener({ type: 'suitelens:mcp', action: 'connect', tabId: 7 }, untrusted, vi.fn()),
      ).toBe(false);
    expect(
      listener({ type: 'suitelens:mcp', action: 'approve', sessionId: 'fake' }, sender(), vi.fn()),
    ).toBe(false);
    expect(browser.runtime.connectNative).not.toHaveBeenCalled();
  });
  it('requires the optional permission and feature before opening a native host', async () => {
    vi.mocked(browser.permissions.contains).mockReturnValue(Promise.resolve(false) as never);
    expect(await control('connect', { tabId: 7 })).toBe(false);
    vi.mocked(browser.permissions.contains).mockReturnValue(Promise.resolve(true) as never);
    await updateSettings({ safeMode: true });
    expect(await control('connect', { tabId: 7 })).toBe(false);
    expect(browser.runtime.connectNative).not.toHaveBeenCalled();
  });
  it('routes approval from an extension action, pins the tab and revokes on navigation', async () => {
    expect(await control('connect', { tabId: 7 })).toBe(true);
    const sessionId = randomUUID();
    const request = {
      type: 'request',
      id: randomUUID(),
      sessionId,
      agent: 'Agent',
      tool: 'get_page_context',
      input: {},
    };
    messages.forEach((fn) => fn(request));
    await vi.waitFor(() =>
      expect(posted).toHaveBeenCalledWith(expect.objectContaining({ error: 'NOT_AUTHORIZED' })),
    );
    expect(await control('approve', { sessionId })).toBe(true);
    messages.forEach((fn) => fn({ ...request, id: randomUUID() }));
    await vi.waitFor(() =>
      expect(posted).toHaveBeenCalledWith(expect.objectContaining({ ok: true })),
    );
    expect(forward).toHaveBeenCalledWith(7, { op: 'getPageContext' });
    updated(7, { status: 'loading' });
    await vi.waitFor(async () => expect((await state()).connected).toBe(false));
    expect(port.disconnect).toHaveBeenCalled();
    expect((await state()).sessions).toEqual([]);
    await control('clearLog');
    expect((await state()).log).toEqual([]);
  });
  it('clears stale connection state after native disconnection', async () => {
    await control('connect', { tabId: 7 });
    disconnected.forEach((fn) => fn());
    await vi.waitFor(async () => expect((await state()).connected).toBe(false));
    expect((await state()).sessions).toEqual([]);
  });
});
