import { browser } from 'wxt/browser';
import { z } from 'zod';
import { accountKey } from './settings';

export const GotoEntrySchema = z.object({
  kind: z.enum(['mapped', 'transaction', 'customrecord']),
  recordType: z.string().optional(),
  customRecordTypeId: z.string().optional(),
  id: z.string(),
  at: z.number(),
});
export type GotoEntry = z.infer<typeof GotoEntrySchema>;

export const GOTO_HISTORY_LIMIT = 10;

export async function getGotoHistory(accountId: string): Promise<GotoEntry[]> {
  const key = accountKey(accountId, 'goto');
  const stored = await browser.storage.local.get(key);
  const parsed = z.array(GotoEntrySchema).safeParse(stored[key]);
  return parsed.success ? parsed.data : [];
}

/** Adds an entry (deduplicated, newest first, max 10) and returns the new history. */
export async function pushGotoHistory(
  accountId: string,
  target: Omit<GotoEntry, 'at'>,
  now: number = Date.now(),
): Promise<GotoEntry[]> {
  const entry: GotoEntry = { ...target, at: now };
  const same = (a: GotoEntry) =>
    a.kind === entry.kind &&
    a.id === entry.id &&
    a.recordType === entry.recordType &&
    a.customRecordTypeId === entry.customRecordTypeId;
  const next = [entry, ...(await getGotoHistory(accountId)).filter((e) => !same(e))].slice(
    0,
    GOTO_HISTORY_LIMIT,
  );
  await browser.storage.local.set({ [accountKey(accountId, 'goto')]: next });
  return next;
}
