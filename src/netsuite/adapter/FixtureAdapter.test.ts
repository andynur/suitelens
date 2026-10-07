import { describe, expect, it, vi } from 'vitest';
import { SO_URL } from '../../test/fixtures';
import { createFixtureAdapter, DEFAULT_FIXTURE_URL } from './FixtureAdapter';
import { loadFixtureSet } from './fixtureSet';

const fixtures = loadFixtureSet();
const adapterFor = (
  url?: string,
  extra: Partial<Parameters<typeof createFixtureAdapter>[0]> = {},
) =>
  createFixtureAdapter({
    fixtures,
    getTargetTab: async () => (url ? { id: 1, url } : undefined),
    now: () => 7,
    ...extra,
  });

describe('loadFixtureSet', () => {
  it('loads every fixture folder', () => {
    expect(Object.keys(fixtures.records).sort()).toEqual([
      'customer-2001',
      'customrecord_suitelens_demo-5',
      'salesorder-1001',
      'salesorder-1002',
    ]);
    expect(Object.keys(fixtures.currentRecords)).toHaveLength(3);
    expect(fixtures.suiteql['automation.scriptDeployments.full']?.length).toBeGreaterThan(0);
    expect(fixtures.customRecordTypes['123']).toBe('customrecord_suitelens_demo');
  });
});

describe('FixtureAdapter', () => {
  it('detects the context from the tab URL, or falls back to the default fixture URL', async () => {
    expect(await adapterFor(SO_URL).getPageContext()).toMatchObject({
      recordType: 'salesorder',
      recordId: '1001',
    });
    expect(await adapterFor('https://example.com').getPageContext()).toBeNull();
    const fallback = await adapterFor(undefined, {
      fallbackUrl: DEFAULT_FIXTURE_URL,
    }).getPageContext();
    expect(fallback?.recordType).toBe('salesorder');
    expect(
      await adapterFor('https://example.com', {
        fallbackUrl: 'https://example.com',
      }).getPageContext(),
    ).toBeNull();
  });

  it('resolves custom record script IDs like the DOM would', async () => {
    const ctx = await adapterFor(
      'https://1234567-sb1.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=123&id=5',
    ).getPageContext();
    expect(ctx).toMatchObject({
      recordType: 'customrecord_suitelens_demo',
      recordTypeSource: 'dom',
    });
    const unknown = await adapterFor(
      'https://1234567-sb1.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=999&id=5',
    ).getPageContext();
    expect(unknown?.recordType).toBeUndefined();
  });

  it('returns merged record fields', async () => {
    const res = await adapterFor(SO_URL).getRecordFields({ recordType: 'salesorder', id: '1001' });
    expect(res.accountId).toBe('1234567-sb1');
    expect(res.recordId).toBe('1001');
    expect(res.sources).toEqual(['xml', 'currentRecord']);
    expect(res.fields.find((f) => f.id === 'memo')).toMatchObject({
      label: 'Memo',
      type: 'textarea',
    });
    expect(res.sublists.find((s) => s.id === 'item')?.fields.length).toBe(6);
    const anyCustomer = await adapterFor(SO_URL).getRecordFields({ recordType: 'customer' });
    expect(anyCustomer.recordId).toBeUndefined();
    expect(anyCustomer.fields.length).toBeGreaterThan(0);
  });

  it('errors for unknown record types and non-NetSuite tabs', async () => {
    await expect(
      adapterFor(SO_URL).getRecordFields({ recordType: 'vendor' }),
    ).rejects.toMatchObject({ code: 'XML_UNAVAILABLE' });
    await expect(adapterFor().getRecordFields({ recordType: 'salesorder' })).rejects.toMatchObject({
      code: 'NOT_NETSUITE',
    });
  });

  it('returns automations and can simulate failures', async () => {
    const res = await adapterFor(SO_URL, { latencyMs: 1 }).getAutomations('salesorder');
    expect(res.items).toHaveLength(7);
    expect(res.fetchedAt).toBe(7);
    await expect(
      adapterFor(SO_URL, { failAutomations: 'PERMISSION_DENIED' }).getAutomations('salesorder'),
    ).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
  });

  it('reports missing SuiteQL fixtures as unavailable tables', async () => {
    const adapter = createFixtureAdapter({
      fixtures: { ...fixtures, suiteql: {} },
      getTargetTab: async () => ({ id: 1, url: SO_URL }),
    });
    await expect(adapter.getAutomations('salesorder')).rejects.toMatchObject({
      code: 'TABLE_UNAVAILABLE',
    });
  });

  it('forwards field highlights to the tab only when it can reach it', async () => {
    expect(await adapterFor(SO_URL).highlightField('memo')).toBe(false);
    const sendToTab = vi.fn(async () => ({ ok: true, data: true }));
    expect(await adapterFor(SO_URL, { sendToTab }).highlightField('memo')).toBe(true);
    expect(sendToTab).toHaveBeenCalledWith(1, { op: 'highlightField', fieldId: 'memo' });
    expect(await adapterFor(undefined, { sendToTab }).highlightField('memo')).toBe(false);
  });
});

describe('FixtureAdapter record XML', () => {
  const ref = { recordType: 'salesorder', id: '1001' };
  const accountId = '1234567-sb1';
  it('returns exact active-record XML without session fields', async () => {
    const xml = await adapterFor(SO_URL).getRecordXml(ref, accountId);
    expect(xml).toContain('SO-FAKE-1001');
    expect(xml).not.toContain('FAKE-CSRF');
    await expect(adapterFor(SO_URL).getRecordXml(ref, 'other')).rejects.toMatchObject({
      code: 'ACCOUNT_MISMATCH',
    });
    await expect(
      adapterFor(SO_URL).getRecordXml({ ...ref, id: '2' }, accountId),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    await expect(
      adapterFor(SO_URL).getRecordXml({ recordType: 'salesorder' }, accountId),
    ).rejects.toMatchObject({ code: 'NOT_A_RECORD' });
    await expect(
      adapterFor(SO_URL.replace('1001', '2')).getRecordXml({ ...ref, id: '2' }, accountId),
    ).rejects.toMatchObject({ code: 'XML_UNAVAILABLE' });
  });
});

it('permits explicit comparisons only within the active account and type, without fixture fallback', async () => {
  const adapter = adapterFor(SO_URL);
  const ref = { recordType: 'salesorder', id: '1002' };
  expect(await adapter.getRecordXml(ref, '1234567-sb1', { comparison: true })).toContain(
    'SO-FAKE-1002',
  );
  await expect(adapter.getRecordXml(ref, '1234567-sb1')).rejects.toMatchObject({
    code: 'UNSUPPORTED',
  });
  await expect(adapter.getRecordXml(ref, 'other', { comparison: true })).rejects.toMatchObject({
    code: 'ACCOUNT_MISMATCH',
  });
  await expect(
    adapter.getRecordXml({ recordType: 'customer', id: '2001' }, '1234567-sb1', {
      comparison: true,
    }),
  ).rejects.toMatchObject({ code: 'UNSUPPORTED' });
  await expect(
    adapter.getRecordXml({ ...ref, id: '999' }, '1234567-sb1', { comparison: true }),
  ).rejects.toMatchObject({ code: 'XML_UNAVAILABLE' });
});
