import { browser } from 'wxt/browser';
import { z } from 'zod';
import { RECORD_TABS, type RecordTab } from '../workspace';
import { accountKey } from './settings';

/**
 * Last Record sub-tab per record type (ADR 0052), per account, local only. Holds tab names and
 * record type IDs, never record data. Capped so it cannot grow without bound.
 */
const MAX_TYPES = 50;
const LastTabsSchema = z.record(z.string().max(128), z.enum(RECORD_TABS)).catch({});

export async function getLastRecordTab(
  accountId: string,
  recordType: string,
): Promise<RecordTab | undefined> {
  const key = accountKey(accountId, 'tabs');
  const stored = await browser.storage.local.get(key);
  return LastTabsSchema.parse(stored[key] ?? {})[recordType];
}

export async function setLastRecordTab(
  accountId: string,
  recordType: string,
  tab: RecordTab,
): Promise<void> {
  const key = accountKey(accountId, 'tabs');
  const stored = await browser.storage.local.get(key);
  const map = LastTabsSchema.parse(stored[key] ?? {});
  delete map[recordType];
  map[recordType] = tab;
  const entries = Object.entries(map).slice(-MAX_TYPES);
  await browser.storage.local.set({ [key]: Object.fromEntries(entries) });
}
