import { describe, expect, it } from 'vitest';
import { clearAccountData } from './accountData';
import { createMetadataCache } from './cache';
import { getGotoHistory, pushGotoHistory } from './gotoHistory';
import { getAccountSettings, updateAccountSettings } from './settings';

describe('clearAccountData', () => {
  it('clears cache and history for one account only, keeping preferences', async () => {
    const cache = createMetadataCache({ dbName: 'account-data-test' });
    await cache.set('1', 'automations', 'k', 1);
    await cache.set('2', 'automations', 'k', 2);
    await pushGotoHistory('1', { kind: 'transaction', id: '5' });
    await pushGotoHistory('2', { kind: 'transaction', id: '6' });
    await updateAccountSettings('1', { label: 'Keep me' });

    await clearAccountData('1', cache);

    expect(await cache.get('1', 'automations', 'k')).toBeUndefined();
    expect(await getGotoHistory('1')).toEqual([]);
    expect((await cache.get('2', 'automations', 'k'))?.value).toBe(2);
    expect(await getGotoHistory('2')).toHaveLength(1);
    expect((await getAccountSettings('1')).label).toBe('Keep me');
  });
});
