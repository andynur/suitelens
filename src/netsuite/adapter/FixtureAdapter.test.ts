import { describe, expect, it } from 'vitest';
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
      'customrecord_loupe_demo-5',
      'salesorder-1001',
    ]);
    expect(Object.keys(fixtures.currentRecords)).toHaveLength(3);
    expect(fixtures.suiteql['automation.scriptDeployments.full']?.length).toBeGreaterThan(0);
    expect(fixtures.customRecordTypes['123']).toBe('customrecord_loupe_demo');
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
    expect(ctx).toMatchObject({ recordType: 'customrecord_loupe_demo', recordTypeSource: 'dom' });
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
    expect(res.items).toHaveLength(6);
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
});
