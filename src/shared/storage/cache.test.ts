import { describe, expect, it } from 'vitest';
import { createMetadataCache } from './cache';

let n = 0;
const newCache = (now: () => number = Date.now) =>
  createMetadataCache({ dbName: `test-${++n}`, now });

describe('metadata cache', () => {
  it('isolates accounts: data from account A never appears for account B', async () => {
    const cache = newCache();
    await cache.set('1234567', 'automations', 'live:salesorder', { from: 'prod' });
    await cache.set('1234567-sb1', 'automations', 'live:salesorder', { from: 'sandbox' });
    expect((await cache.get('1234567', 'automations', 'live:salesorder'))?.value).toEqual({
      from: 'prod',
    });
    expect((await cache.get('1234567-sb1', 'automations', 'live:salesorder'))?.value).toEqual({
      from: 'sandbox',
    });
    expect(await cache.get('7654321', 'automations', 'live:salesorder')).toBeUndefined();
  });

  it('expires entries after the TTL', async () => {
    let now = 1000;
    const cache = newCache(() => now);
    await cache.set('1', 'automations', 'k', 'v', 100);
    expect((await cache.get('1', 'automations', 'k'))?.storedAt).toBe(1000);
    now = 1200;
    expect(await cache.get('1', 'automations', 'k')).toBeUndefined();
  });

  it('clears one account or everything', async () => {
    const cache = newCache();
    await cache.set('1', 'automations', 'a', 1);
    await cache.set('1', 'automations', 'b', 2);
    await cache.set('2', 'automations', 'a', 3);
    await cache.clearAccount('1');
    expect(await cache.get('1', 'automations', 'a')).toBeUndefined();
    expect(await cache.get('1', 'automations', 'b')).toBeUndefined();
    expect((await cache.get('2', 'automations', 'a'))?.value).toBe(3);
    await cache.clearAll();
    expect(await cache.get('2', 'automations', 'a')).toBeUndefined();
  });

  it('rejects invalid account IDs', async () => {
    const cache = newCache();
    await expect(cache.set('a:b', 'automations', 'k', 1)).rejects.toThrow();
    await expect(cache.get('', 'automations', 'k')).rejects.toThrow();
    await expect(cache.clearAccount('X')).rejects.toThrow();
  });
});
