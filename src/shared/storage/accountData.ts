import { browser } from 'wxt/browser';
import { getMetadataCache, type MetadataCache } from './cache';
import { accountKey } from './settings';

/**
 * "Clear cache for this account" (F-1.24): metadata cache and Quick Go-to history.
 * Per-account preferences (banner label, color, environment override) are kept.
 */
export async function clearAccountData(
  accountId: string,
  cache: MetadataCache = getMetadataCache(),
): Promise<void> {
  await Promise.all([
    cache.clearAccount(accountId),
    browser.storage.local.remove(accountKey(accountId, 'goto')),
  ]);
}
