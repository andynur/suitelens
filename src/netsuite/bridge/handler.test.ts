import { describe, expect, it, vi } from 'vitest';
import { createBridgeHandler, stringifyValue, type AmdRequire } from './handler';

type Modules = Record<string, unknown>;

/** Fake NetSuite AMD loader. */
const fakeRequire =
  (modules: Modules, opts: { silent?: boolean } = {}): AmdRequire =>
  (deps, cb, errback) => {
    const name = deps[0]!;
    if (opts.silent) return;
    if (!(name in modules)) {
      errback?.(new Error(`Module ${name} not found`));
      return;
    }
    cb(modules[name]);
  };

const record = {
  type: 'salesorder',
  id: 1001,
  getField: ({ fieldId }: { fieldId: string }) =>
    fieldId === 'memo'
      ? { label: 'Memo', type: 'textarea', isMandatory: false, isDisabled: false, isDisplay: true }
      : fieldId === 'hidden'
        ? { label: 'Hidden', isDisplay: false }
        : null,
  getValue: ({ fieldId }: { fieldId: string }) =>
    fieldId === 'trandate' ? new Date('2026-01-15T00:00:00Z') : 'v',
  getText: ({ fieldId }: { fieldId: string }) => {
    if (fieldId === 'memo') return 'Memo text';
    throw new Error('getText not supported');
  },
  getLineCount: ({ sublistId }: { sublistId: string }) => (sublistId === 'item' ? 2 : -1),
  getSublistField: () => ({ label: 'Item', type: 'select', isMandatory: true }),
};

describe('createBridgeHandler', () => {
  it('ping reports whether require exists', async () => {
    expect(await createBridgeHandler({ globals: {} })({ op: 'ping' })).toEqual({
      ok: true,
      data: { requireAvailable: false },
    });
    expect(
      await createBridgeHandler({ globals: { require: fakeRequire({}) } })({ op: 'ping' }),
    ).toEqual({
      ok: true,
      data: { requireAvailable: true },
    });
  });

  it('getRecordType uses N/currentRecord, then SuiteScript 1.0 globals', async () => {
    const withModule = createBridgeHandler({
      globals: { require: fakeRequire({ 'N/currentRecord': { get: () => record } }) },
    });
    expect(await withModule({ op: 'getRecordType' })).toEqual({
      ok: true,
      data: { recordType: 'salesorder', recordId: '1001' },
    });

    const legacy = createBridgeHandler({
      globals: { nlapiGetRecordType: () => 'customer', nlapiGetRecordId: () => '' },
    });
    expect(await legacy({ op: 'getRecordType' })).toEqual({
      ok: true,
      data: { recordType: 'customer', recordId: null },
    });
  });

  it('getCurrentRecordFields describes fields defensively', async () => {
    const handle = createBridgeHandler({
      globals: { require: fakeRequire({ 'N/currentRecord': { get: () => record } }) },
    });
    const res = await handle({
      op: 'getCurrentRecordFields',
      fieldIds: ['memo', 'hidden', 'trandate'],
      sublists: [
        { id: 'item', fieldIds: ['item'] },
        { id: 'none', fieldIds: ['x'] },
      ],
    });
    expect(res).toEqual({
      ok: true,
      data: {
        recordType: 'salesorder',
        recordId: '1001',
        fields: [
          {
            id: 'memo',
            label: 'Memo',
            type: 'textarea',
            mandatory: false,
            disabled: false,
            hidden: false,
            value: 'v',
            text: 'Memo text',
          },
          { id: 'hidden', label: 'Hidden', hidden: true, value: 'v' },
          { id: 'trandate', value: '2026-01-15T00:00:00.000Z' },
        ],
        sublists: [
          {
            id: 'item',
            lineCount: 2,
            fields: [{ id: 'item', label: 'Item', type: 'select', mandatory: true }],
          },
          { id: 'none', lineCount: 0, fields: [{ id: 'x' }] },
        ],
      },
    });
  });

  it('getCurrentRecordFields never reads token fields', async () => {
    const reads: string[] = [];
    const spy = {
      ...record,
      getValue: ({ fieldId }: { fieldId: string }) => (reads.push(fieldId), 'v'),
    };
    const handle = createBridgeHandler({
      globals: { require: fakeRequire({ 'N/currentRecord': { get: () => spy } }) },
    });
    const res = await handle({
      op: 'getCurrentRecordFields',
      fieldIds: ['_csrf', 'memo'],
      sublists: [{ id: 'item', fieldIds: ['_eml_nkey_'] }],
    });
    expect(reads).toEqual(['memo']);
    expect(JSON.stringify(res)).not.toContain('_csrf');
    expect(JSON.stringify(res)).not.toContain('_eml_nkey_');
  });

  it('getLoadedRecordFields loads read-only through N/record, preferring the promise API', async () => {
    const load = Object.assign(
      vi.fn(() => {
        throw new Error('sync path must not be used');
      }),
      { promise: vi.fn(async () => record) },
    );
    const handle = createBridgeHandler({
      globals: { require: fakeRequire({ 'N/record': { load } }) },
    });
    const res = await handle({
      op: 'getLoadedRecordFields',
      recordType: 'salesorder',
      recordId: '1001',
      fieldIds: ['memo', '_csrf'],
      sublists: [],
    });
    expect(load.promise).toHaveBeenCalledWith({ type: 'salesorder', id: '1001', isDynamic: false });
    expect(res).toMatchObject({
      ok: true,
      data: { recordType: 'salesorder', fields: [{ id: 'memo', type: 'textarea' }] },
    });
  });

  it('getLoadedRecordFields falls back to the sync API and reports failures', async () => {
    const op = {
      op: 'getLoadedRecordFields' as const,
      recordType: 'salesorder',
      recordId: '1001',
      fieldIds: ['memo'],
      sublists: [],
    };
    const sync = createBridgeHandler({
      globals: { require: fakeRequire({ 'N/record': { load: () => record } }) },
    });
    expect(await sync(op)).toMatchObject({ ok: true, data: { fields: [{ id: 'memo' }] } });

    const failing = createBridgeHandler({
      globals: {
        require: fakeRequire({
          'N/record': {
            load: () => {
              throw new Error('INSUFFICIENT_PERMISSION');
            },
          },
        }),
      },
    });
    expect(await failing(op)).toMatchObject({
      ok: false,
      error: { code: 'MODULE_UNAVAILABLE', detail: 'INSUFFICIENT_PERMISSION' },
    });

    const noLoad = createBridgeHandler({
      globals: { require: fakeRequire({ 'N/record': {} }) },
    });
    expect(await noLoad(op)).toMatchObject({ ok: false, error: { code: 'MODULE_UNAVAILABLE' } });
  });

  it('reports missing loader, missing module, broken get() and timeouts', async () => {
    const op = { op: 'getCurrentRecordFields' as const, fieldIds: [], sublists: [] };
    expect(await createBridgeHandler({ globals: {} })(op)).toMatchObject({
      ok: false,
      error: { code: 'REQUIRE_UNAVAILABLE' },
    });
    expect(await createBridgeHandler({ globals: { require: fakeRequire({}) } })(op)).toMatchObject({
      ok: false,
      error: { code: 'MODULE_UNAVAILABLE' },
    });
    const noGet = createBridgeHandler({
      globals: { require: fakeRequire({ 'N/currentRecord': {} }) },
    });
    expect(await noGet(op)).toMatchObject({ ok: false, error: { code: 'MODULE_UNAVAILABLE' } });
    const throwing = createBridgeHandler({
      globals: {
        require: fakeRequire({
          'N/currentRecord': {
            get: () => {
              throw new Error('view mode');
            },
          },
        }),
      },
    });
    expect(await throwing(op)).toMatchObject({
      ok: false,
      error: { code: 'MODULE_UNAVAILABLE', detail: 'view mode' },
    });
    const empty = createBridgeHandler({
      globals: { require: fakeRequire({ 'N/currentRecord': null }) },
    });
    expect(await empty(op)).toMatchObject({ ok: false, error: { code: 'MODULE_UNAVAILABLE' } });
    const throwsSync = createBridgeHandler({
      globals: {
        require: () => {
          throw new Error('loader broken');
        },
      },
    });
    expect(await throwsSync(op)).toMatchObject({
      ok: false,
      error: { code: 'MODULE_UNAVAILABLE' },
    });
    const silent = createBridgeHandler({
      globals: { require: fakeRequire({}, { silent: true }) },
      moduleTimeoutMs: 10,
    });
    expect(await silent(op)).toMatchObject({ ok: false, error: { code: 'TIMEOUT' } });
  });

  it('runSuiteQL runs only allow-listed SQL and caps rows', async () => {
    const seen: string[] = [];
    const runSuiteQL = Object.assign((o: { query: string }) => {
      seen.push(o.query);
      return { asMappedResults: () => [{ a: 1 }, { a: 2 }, { a: 3 }] };
    }, {});
    const handle = createBridgeHandler({
      globals: { require: fakeRequire({ 'N/query': { runSuiteQL } }) },
      maxRows: 2,
    });
    expect(
      await handle({ op: 'runSuiteQL', queryId: 'automation.workflows', variantId: 'base' }),
    ).toEqual({
      ok: true,
      data: [{ a: 1 }, { a: 2 }],
    });
    expect(seen[0]).toContain('FROM workflow');
    expect(
      await handle({ op: 'runSuiteQL', queryId: 'automation.workflows', variantId: 'nope' }),
    ).toMatchObject({
      ok: false,
      error: { code: 'UNSUPPORTED' },
    });
  });

  it('runSuiteQL prefers the promise API and classifies errors', async () => {
    const runSuiteQL = Object.assign(() => ({ asMappedResults: () => [] }), {
      promise: async () => {
        throw { message: 'You do not have permission' };
      },
    });
    const handle = createBridgeHandler({
      globals: { require: fakeRequire({ 'N/query': { runSuiteQL } }) },
    });
    expect(
      await handle({ op: 'runSuiteQL', queryId: 'automation.workflows', variantId: 'full' }),
    ).toMatchObject({
      ok: false,
      error: { code: 'PERMISSION_DENIED', detail: 'You do not have permission' },
    });
    const noRun = createBridgeHandler({ globals: { require: fakeRequire({ 'N/query': {} }) } });
    expect(
      await noRun({ op: 'runSuiteQL', queryId: 'automation.workflows', variantId: 'full' }),
    ).toMatchObject({
      ok: false,
      error: { code: 'MODULE_UNAVAILABLE' },
    });
  });
});

describe('stringifyValue', () => {
  it('stringifies NetSuite values safely', () => {
    expect(stringifyValue(null)).toBeUndefined();
    expect(stringifyValue(undefined)).toBeUndefined();
    expect(stringifyValue(5)).toBe('5');
    expect(stringifyValue(true)).toBe('true');
    expect(stringifyValue(['1', 2])).toBe('1, 2');
    expect(stringifyValue(new Date('invalid'))).toBeUndefined();
    expect(stringifyValue({ a: 1 })).toBeUndefined();
    expect(stringifyValue('x'.repeat(2100))?.length).toBe(2001);
  });
});

describe('console bridge execution', () => {
  const op = {
    op: 'runConsoleQuery',
    sql: 'SELECT id FROM transaction',
    accountId: '1234567-sb1',
  } as const;
  it('runs promise-based read SQL, validates rows and preserves NetSuite errors', async () => {
    const run = Object.assign(vi.fn(), {
      promise: vi.fn(async () => ({ asMappedResults: () => [{ id: 1 }] })),
    });
    const handle = createBridgeHandler({
      globals: { require: fakeRequire({ 'N/query': { runSuiteQL: run } }) },
    });
    expect(await handle(op)).toEqual({ ok: true, data: [{ id: 1 }] });
    expect(run).not.toHaveBeenCalled();
    expect(run.promise).toHaveBeenCalledWith({ query: op.sql, params: [] });
    run.promise.mockRejectedValueOnce(new Error('Unknown identifier: invalid column'));
    expect(await handle(op)).toMatchObject({
      ok: false,
      error: { code: 'TABLE_UNAVAILABLE', detail: 'Unknown identifier: invalid column' },
    });
  });
  it('binds parameters, pages asynchronously and removes only the reserved ordinal', async () => {
    const run = Object.assign(vi.fn(), {
      promise: vi.fn(async () => ({
        asMappedResults: () => [{ id: 1001, internalid: 1001, suitelens_page_row: 1001 }],
      })),
    });
    const handle = createBridgeHandler({
      globals: { require: fakeRequire({ 'N/query': { runSuiteQL: run } }) },
    });
    expect(
      await handle({
        ...op,
        sql: 'SELECT id, id AS internalid FROM transaction WHERE id > ? ORDER BY id',
        params: [1000],
        offset: 1000,
      }),
    ).toEqual({ ok: true, data: [{ id: 1001, internalid: 1001 }] });
    expect(run.promise).toHaveBeenCalledWith({
      query: expect.stringContaining('ROWNUM <= 2000'),
      params: [1000],
    });
    expect(
      await handle({ ...op, sql: 'SELECT id FROM transaction WHERE id = ?', params: [] }),
    ).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED' } });
  });
  it('fails safely when promise execution is unavailable and refuses writes before loading modules', async () => {
    const req = vi.fn(fakeRequire({ 'N/query': { runSuiteQL: vi.fn() } }));
    const handle = createBridgeHandler({ globals: { require: req } });
    expect(await handle({ ...op, sql: 'DELETE FROM transaction' })).toMatchObject({
      ok: false,
      error: { code: 'UNSUPPORTED' },
    });
    expect(req).not.toHaveBeenCalled();
    expect(await handle(op)).toMatchObject({ ok: false, error: { code: 'MODULE_UNAVAILABLE' } });
  });
});
