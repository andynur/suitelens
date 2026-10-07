import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { SuiteLensError } from '../../netsuite/errors';
import {
  FILE_BATCH_SIZE,
  fileDetailsSql,
  mapInventoryRows,
} from '../../netsuite/queries/impactFiles';
import { ImpactScanPlanSchema, type ImpactScanPlan } from './scan';

/** Presentational File Cabinet metadata only. Never reads source or infers script identity. */
export async function readFileNames(
  adapter: NetSuiteAdapter,
  raw: ImpactScanPlan,
  pageUrl: string,
  signal: AbortSignal,
): Promise<Map<string, string>> {
  const plan = ImpactScanPlanSchema.parse(raw);
  const names = new Map<string, string>();
  const check = async () => {
    if (signal.aborted) throw new SuiteLensError('CANCELLED', 'Name lookup cancelled.');
    const context = await adapter.getPageContext();
    if (signal.aborted) throw new SuiteLensError('CANCELLED', 'Name lookup cancelled.');
    if (context?.accountId !== plan.accountId || context.url !== pageUrl)
      throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target changed during name lookup.');
  };
  for (let offset = 0; offset < plan.files.length; offset += FILE_BATCH_SIZE) {
    await check();
    const ids = plan.files.slice(offset, offset + FILE_BATCH_SIZE).map((file) => file.fileId);
    const result = await adapter.runSuiteQL(fileDetailsSql(ids.length), {
      accountId: plan.accountId,
      params: ids,
      maxRows: ids.length,
      signal,
    });
    await check();
    if (result.accountId !== plan.accountId)
      throw new SuiteLensError('ACCOUNT_MISMATCH', 'Name response belongs to another account.');
    // Missing/inaccessible names remain IDs. Reject unrelated rows even if the query response
    // is malformed; metadata must never attach to a different source.
    for (const file of mapInventoryRows(result.rows))
      if (ids.includes(file.fileId) && file.name.trim()) names.set(file.fileId, file.name);
  }
  return names;
}
