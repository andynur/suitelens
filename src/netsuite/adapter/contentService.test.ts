import { describe, expect, it, vi } from 'vitest';
import { loadFixturePage, readFixture, SO_URL } from '../../test/fixtures';
import type { BridgeClient } from '../bridge/transport';
import { SuiteLensError } from '../errors';
import { createContentService, fetchSameOriginText, RECORD_WARNINGS } from './contentService';

const currentRecord = JSON.parse(readFixture('current-record/salesorder-1001.json')) as unknown;

function fakeBridge(
  impl: Partial<Record<string, (payload: unknown) => unknown>> = {},
): BridgeClient {
  return {
    call: vi.fn(async (payload: { op: string }) => {
      const fn = impl[payload.op];
      if (!fn) throw new SuiteLensError('MODULE_UNAVAILABLE', 'n/a');
      return fn(payload);
    }) as unknown as BridgeClient['call'],
    dispose: vi.fn(),
  };
}

function service(
  url: string,
  page: string,
  opts: { bridge?: BridgeClient; xml?: string | Error } = {},
) {
  const fetchText = vi.fn(async () => {
    if (opts.xml instanceof Error) throw opts.xml;
    return opts.xml ?? readFixture('records/salesorder-1001.xml');
  });
  const bridge = opts.bridge ?? fakeBridge();
  return {
    fetchText,
    bridge,
    svc: createContentService({
      getUrl: () => url,
      doc: loadFixturePage(page),
      getBridge: async () => bridge,
      fetchText,
      now: () => 5,
    }),
  };
}

describe('contentService.getPageContext', () => {
  it('detects from URL and DOM', async () => {
    const { svc } = service(SO_URL, 'salesorder-view.html');
    expect(await svc.getPageContext()).toMatchObject({
      recordType: 'salesorder',
      recordId: '1001',
      pageKind: 'record_view',
    });
    const custom = service(
      'https://1234567-sb1.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=123&id=5',
      'customrecord-view.html',
    );
    expect(await custom.svc.getPageContext()).toMatchObject({
      recordType: 'customrecord_suitelens_demo',
      recordTypeSource: 'dom',
    });
  });

  it('asks the bridge when URL and DOM do not know the record type', async () => {
    const bridge = fakeBridge({
      getRecordType: () => ({ recordType: 'inventoryitem', recordId: '77' }),
    });
    const { svc } = service(
      'https://1234567.app.netsuite.com/app/common/item/item.nl?id=77',
      'list.html',
      { bridge },
    );
    expect(await svc.getPageContext()).toMatchObject({
      recordType: 'inventoryitem',
      recordTypeSource: 'bridge',
    });
    const noBridge = service(
      'https://1234567.app.netsuite.com/app/common/item/item.nl?id=77',
      'list.html',
    );
    expect((await noBridge.svc.getPageContext()).recordType).toBeUndefined();
  });

  it('rejects non-NetSuite pages', async () => {
    const { svc } = service('https://example.com/', 'list.html');
    await expect(svc.getPageContext()).rejects.toMatchObject({ code: 'NOT_NETSUITE' });
  });
});

describe('contentService.getRecordFields', () => {
  it('view mode: record XML + page labels + types from a read-only N/record load', async () => {
    const loaded = {
      recordType: 'salesorder',
      recordId: '1001',
      fields: [
        { id: 'entity', label: 'Customer (default)', type: 'select', text: 'ACME (fake)' },
        { id: 'exchangerate', label: 'Exchange Rate', type: 'currency2' },
        { id: 'notinxml', label: 'Never added', type: 'text' },
      ],
      sublists: [],
    };
    const bridge = fakeBridge({ getLoadedRecordFields: () => loaded });
    const { svc, fetchText } = service(SO_URL, 'salesorder-view.html', { bridge });
    const res = await svc.getRecordFields({ recordType: 'salesorder', id: '1001' });
    expect(fetchText).toHaveBeenCalledWith(
      'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001&xml=T',
    );
    expect(bridge.call).toHaveBeenCalledWith(
      expect.objectContaining({
        op: 'getLoadedRecordFields',
        recordType: 'salesorder',
        recordId: '1001',
      }),
      15_000,
    );
    const request = vi.mocked(bridge.call).mock.calls[0]![0] as { fieldIds: string[] };
    expect(request.fieldIds).not.toContain('_csrf');
    expect(res.sources).toEqual(['xml', 'dom', 'loadedRecord']);
    // Form label wins over the default label; type and display text come from N/record.
    expect(res.fields.find((f) => f.id === 'entity')).toMatchObject({
      label: 'Customer',
      type: 'select',
      mandatory: true,
      value: 'ACME (fake)',
    });
    expect(res.fields.find((f) => f.id === 'exchangerate')).toMatchObject({
      label: 'Exchange Rate',
      type: 'currency2',
      value: '1.00',
    });
    expect(res.fields.some((f) => f.id === 'notinxml')).toBe(false);
    expect(res.sublists.map((s) => s.id)).toEqual(['item', 'salesteam']);
    expect(res).toMatchObject({
      accountId: '1234567-sb1',
      recordId: '1001',
      fetchedAt: 5,
      warnings: [],
    });
  });

  it('view mode: still works with a warning when N/record is unavailable', async () => {
    const { svc } = service(SO_URL, 'salesorder-view.html');
    const res = await svc.getRecordFields({ recordType: 'salesorder', id: '1001' });
    expect(res.sources).toEqual(['xml', 'dom']);
    expect(res.warnings).toEqual([RECORD_WARNINGS.loadedRecordUnavailable]);
    expect(res.fields.find((f) => f.id === 'entity')?.value).toBe('2001');
  });

  it('edit mode: adds N/currentRecord metadata', async () => {
    const bridge = fakeBridge({ getCurrentRecordFields: () => currentRecord });
    const { svc } = service(`${SO_URL}&e=T`, 'salesorder-view.html', { bridge });
    const res = await svc.getRecordFields({ recordType: 'salesorder', id: '1001' });
    expect(res.sources).toEqual(['xml', 'dom', 'currentRecord']);
    expect(res.fields.find((f) => f.id === 'memo')?.type).toBe('textarea');
  });

  it('degrades with warnings when sources fail', async () => {
    const { svc } = service(`${SO_URL}&e=T`, 'salesorder-view.html', { xml: new Error('net') });
    const res = await svc.getRecordFields({ recordType: 'salesorder', id: '1001' });
    expect(res.warnings).toEqual([
      RECORD_WARNINGS.xmlUnavailable,
      RECORD_WARNINGS.currentRecordUnavailable,
    ]);
    expect(res.sources).toEqual(['dom']);
  });

  it('fails when no source returns data', async () => {
    const { svc } = service(
      'https://1234567.app.netsuite.com/app/common/item/item.nl?id=7',
      'list.html',
      {
        bridge: fakeBridge({
          getRecordType: () => ({ recordType: 'inventoryitem', recordId: '7' }),
        }),
        xml: '<html>login</html>',
      },
    );
    await expect(
      svc.getRecordFields({ recordType: 'inventoryitem', id: '7' }),
    ).rejects.toMatchObject({ code: 'XML_UNAVAILABLE' });
  });

  it('only reads the record open in the tab', async () => {
    const { svc } = service(SO_URL, 'salesorder-view.html');
    await expect(svc.getRecordFields({ recordType: 'customer', id: '1' })).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
    const list = service(
      'https://1234567.app.netsuite.com/app/accounting/transactions/transactionlist.nl',
      'list.html',
    );
    await expect(list.svc.getRecordFields({ recordType: 'salesorder' })).rejects.toMatchObject({
      code: 'NOT_A_RECORD',
    });
  });
});

describe('contentService.handle', () => {
  it('wraps results and errors', async () => {
    const bridge = fakeBridge({ runSuiteQL: () => [{ id: 1 }] });
    const { svc } = service(SO_URL, 'salesorder-view.html', { bridge });
    expect(
      await svc.handle({ op: 'runQuery', queryId: 'automation.workflows', variantId: 'full' }),
    ).toEqual({
      ok: true,
      data: [{ id: 1 }],
    });
    expect(await svc.handle({ op: 'getPageContext' })).toMatchObject({ ok: true });
    expect(await svc.handle({ op: 'getRecordFields', ref: { recordType: 'x' } })).toMatchObject({
      ok: false,
      error: { code: 'UNSUPPORTED' },
    });
  });

  it('highlights a field through the injected page helper, or reports false', async () => {
    const { svc } = service(SO_URL, 'salesorder-view.html');
    expect(await svc.handle({ op: 'highlightField', fieldId: 'memo' })).toEqual({
      ok: true,
      data: false,
    });
    const withHelper = createContentService({
      getUrl: () => SO_URL,
      doc: loadFixturePage('salesorder-view.html'),
      getBridge: async () => fakeBridge(),
      fetchText: async () => '',
      highlightField: (fieldId) => fieldId === 'memo',
    });
    expect(await withHelper.handle({ op: 'highlightField', fieldId: 'memo' })).toEqual({
      ok: true,
      data: true,
    });
  });
});

describe('fetchSameOriginText', () => {
  const origin = 'https://1234567.app.netsuite.com';

  it('blocks cross-origin URLs', async () => {
    await expect(fetchSameOriginText('https://evil.example/x', origin)).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
  });

  it('fetches with same-origin credentials and checks the status', async () => {
    const fetchMock = vi.fn(async () => new Response('<record/>', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchSameOriginText(`${origin}/a?xml=T`, origin)).resolves.toBe('<record/>');
    expect(fetchMock).toHaveBeenCalledWith(`${origin}/a?xml=T`, {
      credentials: 'same-origin',
      redirect: 'error',
    });
    fetchMock.mockResolvedValueOnce(new Response('', { status: 403 }));
    await expect(fetchSameOriginText(`${origin}/a`, origin)).rejects.toMatchObject({
      code: 'XML_UNAVAILABLE',
    });
    vi.unstubAllGlobals();
  });
});

describe('contentService console', () => {
  const request = {
    op: 'runConsoleQuery',
    sql: 'SELECT id FROM transaction',
    accountId: '1234567-sb1',
  } as const;
  it('checks the target account before bridge calls and returns scoped rows', async () => {
    const bridge = fakeBridge({ runConsoleQuery: () => [{ id: 1 }] });
    const { svc } = service(SO_URL, 'salesorder-view.html', { bridge });
    expect(await svc.handle(request)).toEqual({
      ok: true,
      data: { accountId: request.accountId, rows: [{ id: 1 }], atLimit: false },
    });
    expect(await svc.handle({ ...request, accountId: 'other' })).toMatchObject({
      ok: false,
      error: { code: 'ACCOUNT_MISMATCH' },
    });
    expect(bridge.call).toHaveBeenCalledTimes(1);
  });
  it('rechecks the account after asynchronous bridge initialization', async () => {
    let url = SO_URL;
    const bridge = fakeBridge({ runConsoleQuery: () => [] });
    const svc = createContentService({
      getUrl: () => url,
      doc: document,
      getBridge: async () => {
        url = 'https://1234567.app.netsuite.com/app/center/card.nl';
        return bridge;
      },
      fetchText: vi.fn(),
    });
    expect(await svc.handle(request)).toMatchObject({
      ok: false,
      error: { code: 'ACCOUNT_MISMATCH' },
    });
    expect(bridge.call).not.toHaveBeenCalled();
  });
});

describe('contentService.getRecordXml', () => {
  const ref = { recordType: 'salesorder', id: '1001' };
  const accountId = '1234567-sb1';
  it('reads saved XML through a same-origin URL and removes credentials before responding', async () => {
    const { svc, fetchText, bridge } = service(SO_URL, 'salesorder-view.html');
    const result = await svc.handle({ op: 'getRecordXml', ref, accountId });
    expect(result).toMatchObject({ ok: true, data: expect.stringContaining('SO-FAKE-1001') });
    expect(JSON.stringify(result)).not.toContain('FAKE-CSRF');
    expect(fetchText).toHaveBeenCalledWith(`${SO_URL}&xml=T`);
    expect(bridge.call).not.toHaveBeenCalled();
  });

  it('rejects mismatched accounts, other records and unsaved records before fetching', async () => {
    const { svc, fetchText } = service(SO_URL, 'salesorder-view.html');
    await expect(svc.getRecordXml(ref, 'other')).rejects.toMatchObject({
      code: 'ACCOUNT_MISMATCH',
    });
    await expect(svc.getRecordXml({ ...ref, id: '2' }, accountId)).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
    await expect(svc.getRecordXml({ recordType: 'salesorder' }, accountId)).rejects.toMatchObject({
      code: 'NOT_A_RECORD',
    });
    expect(fetchText).not.toHaveBeenCalled();
  });

  it('rejects a response when the account or record changes while fetching', async () => {
    for (const nextUrl of [SO_URL.replace('sb1', 'sb2'), SO_URL.replace('1001', '1002')]) {
      let url = SO_URL;
      const svc = createContentService({
        getUrl: () => url,
        doc: loadFixturePage('salesorder-view.html'),
        getBridge: async () => fakeBridge(),
        fetchText: async () => {
          url = nextUrl;
          return readFixture('records/salesorder-1001.xml');
        },
      });
      await expect(svc.getRecordXml(ref, accountId)).rejects.toBeInstanceOf(SuiteLensError);
    }
  });
});

it('comparison reads another ID at the active same-origin endpoint and verifies identity', async () => {
  const ref = { recordType: 'salesorder', id: '1002' };
  const accountId = '1234567-sb1';
  const { svc, fetchText } = service(SO_URL, 'salesorder-view.html', {
    xml: readFixture('records/salesorder-1002.xml'),
  });
  expect(await svc.handle({ op: 'getRecordXml', ref, accountId, comparison: true })).toMatchObject({
    ok: true,
    data: expect.stringContaining('SO-FAKE-1002'),
  });
  expect(fetchText).toHaveBeenCalledWith(SO_URL.replace('1001', '1002') + '&xml=T');
  fetchText.mockClear();
  for (const wrong of [
    { recordType: 'customer', id: '1002' },
    { ...ref, id: 'https://evil.test' },
  ]) {
    await expect(svc.getRecordXml(wrong, accountId, true)).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
  }
  expect(fetchText).not.toHaveBeenCalled();
  for (const xml of [
    '<record/>',
    '<record recordType="salesorder" id="999"/>',
    '<record recordType="customer" id="1002"/>',
  ]) {
    const mismatch = service(SO_URL, 'salesorder-view.html', { xml });
    await expect(mismatch.svc.getRecordXml(ref, accountId, true)).rejects.toMatchObject({
      code: 'XML_UNAVAILABLE',
    });
  }
});

it('comparison preserves custom record type and rejects navigation during the request', async () => {
  const customUrl =
    'https://1234567-sb1.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=123&id=5';
  const custom = service(customUrl, 'customrecord-view.html', {
    xml: '<record recordType="customrecord_suitelens_demo" id="6"/>',
  });
  await custom.svc.getRecordXml(
    { recordType: 'customrecord_suitelens_demo', id: '6' },
    '1234567-sb1',
    true,
  );
  expect(custom.fetchText).toHaveBeenCalledWith(
    'https://1234567-sb1.app.netsuite.com/app/common/custom/custrecordentry.nl?id=6&rectype=123&xml=T',
  );
  for (const nextUrl of [SO_URL.replace('sb1', 'sb2'), SO_URL.replace('1001', '1003')]) {
    let url = SO_URL;
    const svc = createContentService({
      getUrl: () => url,
      doc: loadFixturePage('salesorder-view.html'),
      getBridge: async () => fakeBridge(),
      fetchText: async () => {
        url = nextUrl;
        return readFixture('records/salesorder-1002.xml');
      },
    });
    await expect(
      svc.getRecordXml({ recordType: 'salesorder', id: '1002' }, '1234567-sb1', true),
    ).rejects.toBeInstanceOf(SuiteLensError);
  }
});
