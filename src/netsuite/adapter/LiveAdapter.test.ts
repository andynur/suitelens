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
    expect(res.items).toHaveLength(6);
    expect(send).toHaveBeenCalledWith(3, {
      op: 'runQuery',
      queryId: 'automation.scriptDeployments',
      variantId: 'full',
    });
  });
});
