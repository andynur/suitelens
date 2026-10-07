import { describe, expect, it, vi } from 'vitest';
import { readFixture, SO_URL } from '../../test/fixtures';
import type { ContentRequest } from '../bridge/protocol';
import { createLiveAdapter, type SendToTab } from './LiveAdapter';

const ctx = {
  accountId: '1234567-sb1',
  environment: 'sandbox',
  pageKind: 'record_view',
  recordType: 'salesorder',
  recordId: '1001',
  url: SO_URL,
  detectedAt: 1,
};

const tab = (url?: string) => async () => (url === undefined ? undefined : { id: 3, url });

describe('LiveAdapter', () => {
  it('returns null when the tab is not NetSuite', async () => {
    const send = vi.fn<SendToTab>();
    const adapter = createLiveAdapter({
      getTargetTab: tab('https://example.com'),
      sendToTab: send,
    });
    expect(await adapter.getPageContext()).toBeNull();
    expect(
      await createLiveAdapter({ getTargetTab: tab(), sendToTab: send }).getPageContext(),
    ).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('validates content script responses', async () => {
    const adapter = createLiveAdapter({
      getTargetTab: tab(SO_URL),
      sendToTab: async () => ({ ok: true, data: ctx }),
    });
    expect(await adapter.getPageContext()).toEqual(ctx);
    const bad = createLiveAdapter({
      getTargetTab: tab(SO_URL),
      sendToTab: async () => ({ ok: true, data: { nope: 1 } }),
    });
    await expect(bad.getPageContext()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('falls back to URL detection when the content script is unreachable', async () => {
    const adapter = createLiveAdapter({
      getTargetTab: tab(SO_URL),
      sendToTab: async () => ({ ok: false, error: { code: 'NO_CONTENT_SCRIPT', message: 'x' } }),
    });
    expect(await adapter.getPageContext()).toMatchObject({
      recordType: 'salesorder',
      recordTypeSource: 'url',
    });
    const failing = createLiveAdapter({
      getTargetTab: tab(SO_URL),
      sendToTab: async () => ({ ok: false, error: { code: 'TIMEOUT', message: 'x' } }),
    });
    await expect(failing.getPageContext()).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('forwards record field requests to the target tab', async () => {
    const result = {
      accountId: '1234567-sb1',
      recordType: 'salesorder',
      fields: [],
      sublists: [],
      sources: ['xml'],
      warnings: [],
      fetchedAt: 1,
    };
    const send = vi.fn<SendToTab>(async () => ({ ok: true, data: result }));
    const adapter = createLiveAdapter({ getTargetTab: tab(SO_URL), sendToTab: send });
    expect(await adapter.getRecordFields({ recordType: 'salesorder', id: '1001' })).toEqual(result);
    expect(send).toHaveBeenCalledWith(3, {
      op: 'getRecordFields',
      ref: { recordType: 'salesorder', id: '1001' },
    });
    await expect(
      createLiveAdapter({
        getTargetTab: tab('https://example.com'),
        sendToTab: send,
      }).getRecordFields({ recordType: 'x' }),
    ).rejects.toMatchObject({ code: 'NOT_NETSUITE' });
  });

  it('loads automations through allow-listed query requests', async () => {
    const send = vi.fn<SendToTab>(async (_tabId, req: ContentRequest) => {
      if (req.op !== 'runQuery') throw new Error('unexpected');
      return {
        ok: true,
        data: JSON.parse(readFixture(`suiteql/${req.queryId}.${req.variantId}.json`)) as unknown,
      };
    });
    const res = await createLiveAdapter({
      getTargetTab: tab(SO_URL),
      sendToTab: send,
    }).getAutomations('salesorder');
    expect(res.accountId).toBe('1234567-sb1');
    expect(res.items).toHaveLength(7);
    expect(send).toHaveBeenCalledWith(3, {
      op: 'runQuery',
      queryId: 'automation.scriptDeployments',
      variantId: 'full',
    });
  });

  it('asks the content script to highlight a field', async () => {
    const send = vi.fn<SendToTab>(async () => ({ ok: true, data: true }));
    const adapter = createLiveAdapter({ getTargetTab: tab(SO_URL), sendToTab: send });
    expect(await adapter.highlightField('memo')).toBe(true);
    expect(send).toHaveBeenCalledWith(3, { op: 'highlightField', fieldId: 'memo' });
  });
});

describe('LiveAdapter console execution', () => {
  const sql = 'SELECT id FROM transaction';
  const accountId = '1234567-sb1';
  it('forwards user SQL and validates the account on both sides', async () => {
    const data = { accountId, rows: [{ id: 1 }], atLimit: false };
    const send = vi.fn<SendToTab>(async () => ({ ok: true, data }));
    const adapter = createLiveAdapter({ getTargetTab: tab(SO_URL), sendToTab: send });
    expect(await adapter.runSuiteQL(sql, { accountId })).toEqual(data);
    expect(send).toHaveBeenCalledWith(3, {
      op: 'runConsoleQuery',
      sql,
      accountId,
      params: [],
      offset: 0,
    });
    await expect(adapter.runSuiteQL(sql, { accountId: 'other' })).rejects.toMatchObject({
      code: 'ACCOUNT_MISMATCH',
    });
    expect(send).toHaveBeenCalledTimes(1);
    send.mockResolvedValueOnce({ ok: true, data: { ...data, accountId: 'other' } });
    await expect(adapter.runSuiteQL(sql, { accountId })).rejects.toMatchObject({
      code: 'ACCOUNT_MISMATCH',
    });
    send.mockResolvedValueOnce({ ok: true, data: { ...data, rows: [{ nested: {} }] } });
    await expect(adapter.runSuiteQL(sql, { accountId })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
  it('explains a missing response from an older extension component', async () => {
    const adapter = createLiveAdapter({ getTargetTab: tab(SO_URL), sendToTab: async () => null });
    await expect(adapter.runSuiteQL(sql, { accountId })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      detail: expect.stringContaining('chrome://extensions'),
    });
  });
  it('does not dispatch after cancellation while resolving the target tab', async () => {
    let resolveTab!: (target: { id: number; url: string }) => void;
    const send = vi.fn<SendToTab>();
    const adapter = createLiveAdapter({
      getTargetTab: () =>
        new Promise((resolve) => {
          resolveTab = resolve;
        }),
      sendToTab: send,
    });
    const controller = new AbortController();
    const result = adapter.runSuiteQL(sql, { accountId, signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    await expect(result).rejects.toMatchObject({ code: 'CANCELLED' });
    resolveTab({ id: 3, url: SO_URL });
    await Promise.resolve();
    expect(send).not.toHaveBeenCalled();
  });
  it('blocks write SQL and returns original NetSuite error details', async () => {
    const send = vi.fn<SendToTab>(async () => ({
      ok: false,
      error: {
        code: 'TABLE_UNAVAILABLE',
        message: 'Failed',
        detail: 'Unknown identifier: missing_field',
      },
    }));
    const adapter = createLiveAdapter({ getTargetTab: tab(SO_URL), sendToTab: send });
    await expect(
      adapter.runSuiteQL('DELETE FROM transaction', { accountId }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect(send).not.toHaveBeenCalled();
    await expect(adapter.runSuiteQL(sql, { accountId })).rejects.toMatchObject({
      code: 'TABLE_UNAVAILABLE',
      detail: 'Unknown identifier: missing_field',
    });
  });
});

describe('LiveAdapter record XML', () => {
  const ref = { recordType: 'salesorder', id: '1001' };
  const accountId = '1234567-sb1';
  it('forwards an account-scoped request and validates the response', async () => {
    const send = vi.fn<SendToTab>(async () => ({ ok: true, data: '<record/>' }));
    const adapter = createLiveAdapter({ getTargetTab: tab(SO_URL), sendToTab: send });
    expect(await adapter.getRecordXml(ref, accountId)).toBe('<record/>');
    expect(send).toHaveBeenCalledWith(3, { op: 'getRecordXml', ref, accountId });
    await expect(adapter.getRecordXml(ref, 'other')).rejects.toMatchObject({
      code: 'ACCOUNT_MISMATCH',
    });
    send.mockResolvedValueOnce({ ok: true, data: { xml: 'bad' } });
    await expect(adapter.getRecordXml(ref, accountId)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('discards XML when the target changes during the request', async () => {
    let url = SO_URL;
    const adapter = createLiveAdapter({
      getTargetTab: async () => ({ id: 3, url }),
      sendToTab: async () => {
        url = SO_URL.replace('1001', '1002');
        return { ok: true, data: '<record/>' };
      },
    });
    await expect(adapter.getRecordXml(ref, accountId)).rejects.toMatchObject({
      code: 'ACCOUNT_MISMATCH',
    });
  });
});

it('forwards the explicit comparison option through validated transport', async () => {
  const send = vi.fn<SendToTab>(async () => ({ ok: true, data: '<record/>' }));
  const adapter = createLiveAdapter({ getTargetTab: tab(SO_URL), sendToTab: send });
  const ref = { recordType: 'salesorder', id: '1002' };
  await adapter.getRecordXml(ref, '1234567-sb1', { comparison: true });
  expect(send).toHaveBeenCalledWith(3, {
    op: 'getRecordXml',
    ref,
    accountId: '1234567-sb1',
    comparison: true,
  });
});
