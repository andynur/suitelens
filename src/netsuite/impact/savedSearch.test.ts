import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFixture, SO_URL } from '../../test/fixtures';
import { fixtureAdapter } from '../../test/adapters';
import { createLiveAdapter } from '../adapter/LiveAdapter';
import { createContentService } from '../adapter/contentService';
import { createBridgeHandler } from '../bridge/handler';
import type { BridgeClient } from '../bridge/transport';
import { ContentRequestSchema, BridgeOpSchema } from '../bridge/protocol';
import {
  findSavedSearchLink,
  ImpactSavedSearchSchema,
  loadSavedSearchDefinition,
  mapSavedSearchDefinition,
  SAVED_SEARCH_LIMITS,
} from './savedSearch';

const raw = JSON.parse(readFixture('impact-analysis/saved-search.json')) as Record<string, unknown>;
const req = { accountId: '1234567-sb1', searchId: '503' };
const definition = () => mapSavedSearchDefinition(raw, req.searchId);
const doc = () =>
  new DOMParser().parseFromString(
    '<a href="/app/common/search/search.nl?id=503">Demo flagged orders</a>',
    'text/html',
  );
afterEach(() => vi.useRealTimers());

describe('saved search definition access', () => {
  it.each(['', '0', '-1', '1&delete=T', 'customscript_test', 'x'.repeat(129)])(
    'rejects invalid source IDs: %s',
    (searchId) => {
      expect(
        ContentRequestSchema.safeParse({
          op: 'readImpactSavedSearch',
          request: { ...req, searchId },
        }).success,
      ).toBe(false);
      expect(BridgeOpSchema.safeParse({ op: 'readImpactSavedSearch', searchId }).success).toBe(
        false,
      );
    },
  );
  it('projects only definition fields and never touches filter values, results or writes', () => {
    const filters = [
      {
        name: 'custbody_demo_flag',
        get values() {
          throw new Error('must not read values');
        },
      },
    ];
    const projected = mapSavedSearchDefinition(
      {
        ...raw,
        filters,
        get run() {
          throw new Error('must not run');
        },
        get save() {
          throw new Error('must not save');
        },
      },
      'customsearch_demo_flag',
    );
    expect(projected).toMatchObject({
      internalId: '503',
      scriptId: 'customsearch_demo_flag',
      title: 'Demo flagged orders',
      isPublic: true,
      filters: [{ name: 'custbody_demo_flag' }],
    });
    expect(JSON.stringify(projected)).not.toContain('values');
    expect(
      mapSavedSearchDefinition({ ...raw, isPublic: undefined, columns: ['internalid'] }, '503'),
    ).toMatchObject({ columns: [{ name: 'internalid' }] });
    expect(
      mapSavedSearchDefinition({ ...raw, isPublic: undefined }, '503').isPublic,
    ).toBeUndefined();
  });
  it('rejects mismatched identity, invalid metadata and oversized definitions without values in errors', () => {
    for (const value of [
      null,
      { ...raw, searchId: 504 },
      { ...raw, isPublic: 'F' },
      { ...raw, filters: Array.from({ length: 501 }, () => ({ name: 'memo' })) },
      { ...raw, columns: [{ name: 'formulatext', formula: 'secret'.repeat(5000) }] },
    ])
      expect(() => mapSavedSearchDefinition(value, '503')).toThrow();
    expect(() => mapSavedSearchDefinition(raw, 'customsearch_other')).toThrow('identity');
  });
  it('loads through the fixed bridge operation with the promise API, without running or saving', async () => {
    const load = Object.assign(vi.fn(), { promise: vi.fn(async () => raw) });
    const handle = createBridgeHandler({
      globals: {
        require: (deps: string[], callback: (module: unknown) => void) => {
          expect(deps).toEqual(['N/search']);
          callback({ load });
        },
      },
    });
    expect(await handle({ op: 'readImpactSavedSearch', searchId: '503' })).toMatchObject({
      ok: true,
      data: definition(),
    });
    expect(load.promise).toHaveBeenCalledWith({ id: '503' });
    expect(load).not.toHaveBeenCalled();
  });
  it('preserves permission failures and bounds hanging reads; no raw exception details', async () => {
    await expect(loadSavedSearchDefinition({}, '503')).rejects.toMatchObject({
      code: 'MODULE_UNAVAILABLE',
    });
    const denied = Object.assign(new Error('private filter values'), {
      name: 'SSS_PERMISSION_VIOLATION',
    });
    try {
      await loadSavedSearchDefinition(
        {
          load: {
            promise: async () => {
              throw denied;
            },
          },
        },
        '503',
      );
    } catch (error) {
      expect(error).toMatchObject({ code: 'PERMISSION_DENIED' });
      expect(String(error)).not.toContain('private filter');
    }
    vi.useFakeTimers();
    const result = expect(
      loadSavedSearchDefinition({ load: { promise: () => new Promise(() => undefined) } }, '503'),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(SAVED_SEARCH_LIMITS.timeoutMs);
    await result;
  });
  it('offers only observed same-origin definition links', () => {
    expect(findSavedSearchLink(doc(), SO_URL, '503')).toBe(
      new URL('/app/common/search/search.nl?id=503', SO_URL).href,
    );
    expect(findSavedSearchLink(doc(), SO_URL, '504')).toBeUndefined();
    for (const href of [
      'https://evil.example/app/common/search/search.nl?id=503',
      '/app/common/search/search.nl?id=503&delete=T',
      '/app/common/search/search.nl?id=503&id=504',
      '/app/common/search/searchresults.nl?id=503',
      '/app/common/search/search.nl?id=503&e=X',
    ]) {
      const page = doc();
      page.querySelector('a')!.setAttribute('href', href);
      expect(findSavedSearchLink(page, SO_URL, '503')).toBeUndefined();
    }
  });
  it('content service scopes bridge reads and discards navigation replies', async () => {
    let pageUrl = SO_URL;
    const call = vi.fn(async () => definition());
    const bridge = { call, dispose: vi.fn() } as unknown as BridgeClient;
    const getBridge = vi.fn(async () => bridge);
    const service = createContentService({
      getUrl: () => pageUrl,
      doc: doc(),
      getBridge,
      fetchText: vi.fn(),
    });
    expect(await service.handle({ op: 'readImpactSavedSearch', request: req })).toMatchObject({
      ok: true,
      data: { ...req, definition: definition() },
    });
    expect(call).toHaveBeenCalledWith({ op: 'readImpactSavedSearch', searchId: '503' });
    const count = getBridge.mock.calls.length;
    expect(
      await service.handle({ op: 'readImpactSavedSearch', request: { ...req, accountId: '9999' } }),
    ).toMatchObject({ ok: false, error: { code: 'ACCOUNT_MISMATCH' } });
    expect(getBridge).toHaveBeenCalledTimes(count);
    call.mockImplementationOnce(async () => {
      pageUrl += '&changed=T';
      return definition();
    });
    expect(await service.handle({ op: 'readImpactSavedSearch', request: req })).toMatchObject({
      ok: false,
      error: { code: 'ACCOUNT_MISMATCH' },
    });
  });
  it('live adapter checks identity, account, origin and tab ownership', async () => {
    let tab = { id: 1, url: SO_URL };
    const source = {
      ...req,
      definition: definition(),
      objectUrl: new URL('/app/common/search/search.nl?id=503', SO_URL).href,
    };
    const sendToTab = vi.fn(async () => ({ ok: true, data: source }));
    const adapter = createLiveAdapter({ getTargetTab: async () => tab, sendToTab });
    expect(await adapter.readImpactSavedSearch(req)).toEqual(source);
    for (const data of [
      { ...source, accountId: '9999' },
      { ...source, definition: { ...source.definition, internalId: '504' } },
      { ...source, objectUrl: 'https://evil.example/search' },
    ]) {
      sendToTab.mockResolvedValueOnce({ ok: true, data });
      await expect(adapter.readImpactSavedSearch(req)).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      });
    }
    sendToTab.mockImplementationOnce(async () => {
      tab = { id: 2, url: SO_URL };
      return { ok: true, data: source };
    });
    await expect(adapter.readImpactSavedSearch(req)).rejects.toMatchObject({
      code: 'ACCOUNT_MISMATCH',
    });
    await expect(
      adapter.readImpactSavedSearch({ ...req, accountId: '9999' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
    expect(
      ImpactSavedSearchSchema.safeParse({
        ...source,
        definition: { ...source.definition, raw: 'secret' },
      }).success,
    ).toBe(false);
  });
  it('fixture adapter loads exact IDs and observed links with no fallback', async () => {
    const adapter = fixtureAdapter();
    expect(await adapter.readImpactSavedSearch(req)).toMatchObject({
      definition: definition(),
      objectUrl: new URL('/app/common/search/search.nl?id=503', SO_URL).href,
    });
    expect(
      await adapter.readImpactSavedSearch({ ...req, searchId: 'customsearch_demo_flag' }),
    ).toMatchObject({ definition: definition() });
    await expect(adapter.readImpactSavedSearch({ ...req, searchId: '504' })).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
  });
});
