import { describe, expect, it, vi } from 'vitest';
import { fixtureAdapter } from '../../test/adapters';
import { createMetadataCache } from '../../shared/storage/cache';
import { loadAutomationsCached } from './load';

let n = 0;
const cache = () => createMetadataCache({ dbName: `automation-test-${++n}` });

const PROD_URL = 'https://1234567.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001';
const SB_URL =
  'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001';

describe('loadAutomationsCached', () => {
  it('serves from cache until a forced refresh', async () => {
    const c = cache();
    const adapter = fixtureAdapter(SB_URL);
    const spy = vi.spyOn(adapter, 'getAutomations');
    const first = await loadAutomationsCached(adapter, c, '1234567-sb1', 'salesorder', false);
    expect(first.fromCache).toBe(false);
    const second = await loadAutomationsCached(adapter, c, '1234567-sb1', 'salesorder', false);
    expect(second.fromCache).toBe(true);
    expect(second.result.items).toHaveLength(7);
    await loadAutomationsCached(adapter, c, '1234567-sb1', 'salesorder', true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('never shows account A cache while viewing account B', async () => {
    const c = cache();
    await loadAutomationsCached(fixtureAdapter(SB_URL), c, '1234567-sb1', 'salesorder', false);
    const prodAdapter = fixtureAdapter(PROD_URL);
    const spy = vi.spyOn(prodAdapter, 'getAutomations');
    const prod = await loadAutomationsCached(prodAdapter, c, '1234567', 'salesorder', false);
    expect(prod.fromCache).toBe(false);
    expect(prod.result.accountId).toBe('1234567');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('rejects and does not cache results from another account', async () => {
    const c = cache();
    const adapter = fixtureAdapter(SB_URL);
    await expect(
      loadAutomationsCached(adapter, c, '1234567', 'salesorder', false),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_MISMATCH',
    });
    expect(await c.get('1234567', 'automations', 'v2:fixture:salesorder')).toBeUndefined();
  });

  it('ignores entries cached by an older query version', async () => {
    const c = cache();
    const stale = {
      accountId: '1234567-sb1',
      recordType: 'salesorder',
      items: [],
      complete: true,
      warnings: [],
      fetchedAt: 1,
    };
    await c.set('1234567-sb1', 'automations', 'fixture:salesorder', stale);
    const res = await loadAutomationsCached(
      fixtureAdapter(SB_URL),
      c,
      '1234567-sb1',
      'salesorder',
      false,
    );
    expect(res.fromCache).toBe(false);
    expect(res.result.items.length).toBeGreaterThan(0);
  });
});
