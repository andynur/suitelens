import { afterEach, expect, it, vi } from 'vitest';
import { recordContext } from '../../test/adapters';
import { authorizeRestlet, fetchRestlet, validateRestletRequest } from './request';
import { createContentService } from '../adapter/contentService';
import { createLiveAdapter } from '../adapter/LiveAdapter';
import {
  emptyCollection,
  getRestletCollection,
  resolveRequestVariables,
  saveRestletCollection,
} from '../../shared/storage/restletCollections';
const req = () =>
  validateRestletRequest({
    accountId: '1234567-sb1',
    script: '501',
    deploy: '601',
    method: 'GET',
    params: {},
    headers: {},
    body: '',
  });
afterEach(() => vi.unstubAllGlobals());
it('rejects credentials, reserved parameters, browser headers and malformed bodies', () => {
  for (const patch of [
    { headers: { Authorization: 'secret' } },
    { params: { deploy: '2' } },
    { headers: { Host: 'evil.test' } },
    { body: '{' },
    { method: 'POST', body: '{"nested":{"password":"x"}}' },
    { body: '{}' },
  ]) {
    expect(() => validateRestletRequest({ ...req(), ...patch })).toThrow();
  }
});
it('requires write confirmation everywhere and production opt-in independently of UI', () => {
  const write = { ...req(), method: 'POST' as const };
  expect(() => authorizeRestlet(write, recordContext())).toThrow(/Confirm/);
  authorizeRestlet({ ...write, confirmed: true }, recordContext());
  const prod = { ...recordContext(), environment: 'production' as const };
  expect(() => authorizeRestlet({ ...write, confirmed: true }, prod)).toThrow(/blocked/);
  authorizeRestlet({ ...write, confirmed: true }, prod, true);
  expect(() => authorizeRestlet(write, { ...prod, accountId: 'other' }, true)).toThrow(/Account/);
  expect(() =>
    authorizeRestlet({ ...write, confirmed: true }, { ...prod, environment: 'unknown' }, true),
  ).toThrow();
});
it('uses only the account origin, session credentials and no redirects; measures UTF-8 bytes', async () => {
  const body = '{"value":"é"}';
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  vi.stubGlobal('fetch', fetch);
  const response = await fetchRestlet(
    { ...req(), params: { q: 'a&b' } },
    new URL(recordContext().url).origin,
  );
  const [url, options] = fetch.mock.calls[0]!;
  expect(new URL(url).origin).toBe('https://1234567-sb1.app.netsuite.com');
  expect(new URL(url).searchParams.get('q')).toBe('a&b');
  expect(options).toMatchObject({ credentials: 'same-origin', redirect: 'error', method: 'GET' });
  expect(response.bytes).toBe(new TextEncoder().encode(body).length);
  expect(response.body).toBe(body);
});
it('explains HTML/login responses, permission errors, redirects and oversized responses', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  for (const response of [
    new Response('denied', { status: 403 }),
    new Response('<html>', { headers: { 'Content-Type': 'text/html' } }),
  ]) {
    fetch.mockResolvedValueOnce(response);
    await expect(fetchRestlet(req(), new URL(recordContext().url).origin)).rejects.toThrow(
      /Browser-session/,
    );
  }
  fetch.mockRejectedValueOnce(new TypeError('redirect'));
  await expect(fetchRestlet(req(), new URL(recordContext().url).origin)).rejects.toThrow(
    /Cross-origin/,
  );
  fetch.mockResolvedValueOnce(new Response('x'.repeat(2 * 1024 * 1024 + 1)));
  await expect(fetchRestlet(req(), new URL(recordContext().url).origin)).rejects.toThrow(/2 MB/);
});
it('enforces content-side production policy and refuses stale live targets', async () => {
  const restletFetch = vi.fn();
  const url = recordContext().url.replace('-sb1', '');
  const service = createContentService({
    getUrl: () => url,
    doc: document,
    getBridge: vi.fn(),
    fetchText: vi.fn(),
    restletFetch,
  });
  const result = await service.handle({
    op: 'callRestlet',
    request: { ...req(), accountId: '1234567', method: 'POST', confirmed: true },
  });
  expect(result).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  expect(restletFetch).not.toHaveBeenCalled();
  const getTargetTab = vi
    .fn()
    .mockResolvedValueOnce({ id: 1, url: recordContext().url })
    .mockResolvedValueOnce({ id: 2, url: recordContext().url });
  const adapter = createLiveAdapter({
    getTargetTab,
    sendToTab: vi
      .fn()
      .mockResolvedValue({ ok: true, data: { status: 200, elapsedMs: 1, bytes: 2, body: '{}' } }),
  });
  await expect(adapter.callRestlet(req())).rejects.toThrow(/Target changed/);
});
it('isolates collections, drops confirmation, resolves variables and rejects credential persistence', async () => {
  const collection = emptyCollection();
  collection.requests.push({
    name: 'demo',
    request: { ...req(), confirmed: true, params: { q: '{{query}}' } },
  });
  collection.presets.sandbox = { query: 'demo' };
  await saveRestletCollection('1234567-sb1', collection);
  const saved = await getRestletCollection('1234567-sb1');
  expect(saved.requests[0]?.request.confirmed).toBe(false);
  expect((await getRestletCollection('1234567')).requests).toEqual([]);
  expect(resolveRequestVariables(saved.requests[0]!.request, saved.presets.sandbox).params).toEqual(
    { q: 'demo' },
  );
  expect(() => resolveRequestVariables(saved.requests[0]!.request, {})).toThrow(/Missing variable/);
  collection.presets.production = { api_key: 'secret' };
  await expect(saveRestletCollection('1234567-sb1', collection)).rejects.toThrow(/Credential/);
  await expect(saveRestletCollection('1234567', saved)).rejects.toThrow(/mismatch/);
});
