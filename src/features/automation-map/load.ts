import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { LoupeError } from '../../netsuite/errors';
import { AutomationResultSchema, type AutomationResult } from '../../netsuite/types';
import type { MetadataCache } from '../../shared/storage/cache';

export type AutomationLoad = { result: AutomationResult; fromCache: boolean; storedAt: number };

/**
 * Automation Map data with a per-account cache (F-1.16, 24 h TTL). `force` bypasses the
 * cache (refresh button). Results from another account are rejected, never cached.
 */
export async function loadAutomationsCached(
  adapter: NetSuiteAdapter,
  cache: MetadataCache,
  accountId: string,
  recordType: string,
  force: boolean,
): Promise<AutomationLoad> {
  const key = `${adapter.kind}:${recordType}`;
  if (!force) {
    const hit = await cache.get<unknown>(accountId, 'automations', key).catch(() => undefined);
    const parsed = hit ? AutomationResultSchema.safeParse(hit.value) : undefined;
    if (hit && parsed?.success && parsed.data.accountId === accountId) {
      return { result: parsed.data, fromCache: true, storedAt: hit.storedAt };
    }
  }
  const result = await adapter.getAutomations(recordType);
  if (result.accountId !== accountId) {
    throw new LoupeError('ACCOUNT_MISMATCH', 'Account changed while loading.');
  }
  await cache.set(accountId, 'automations', key, result).catch(() => undefined);
  return { result, fromCache: false, storedAt: result.fetchedAt };
}
