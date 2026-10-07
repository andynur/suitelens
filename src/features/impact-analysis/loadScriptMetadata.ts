import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { SuiteLensError } from '../../netsuite/errors';
import {
  AutomationResultSchema,
  type AutomationResult,
  type PageContext,
} from '../../netsuite/types';
import type { ImpactScanProgress } from './scan';

/** Reuses record-scoped Automation Map access, without broadening its source coverage. */
export async function readScriptMetadata(
  adapter: NetSuiteAdapter,
  context: PageContext,
  signal: AbortSignal,
): Promise<AutomationResult> {
  if (!context.recordType)
    throw new SuiteLensError('NOT_A_RECORD', 'Open a record to read script metadata.');
  const check = async () => {
    if (signal.aborted) throw new SuiteLensError('CANCELLED', 'Metadata lookup cancelled.');
    const current = await adapter.getPageContext();
    if (signal.aborted) throw new SuiteLensError('CANCELLED', 'Metadata lookup cancelled.');
    if (
      current?.accountId !== context.accountId ||
      current.url !== context.url ||
      current.recordType !== context.recordType
    )
      throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target changed during metadata lookup.');
  };
  await check();
  const result = AutomationResultSchema.parse(await adapter.getAutomations(context.recordType));
  await check();
  if (result.accountId !== context.accountId || result.recordType !== context.recordType)
    throw new SuiteLensError(
      'ACCOUNT_MISMATCH',
      'Metadata belongs to another account or record type.',
    );
  return result;
}

/** A source hit is only a candidate. Missing/conflicting activity metadata stays unknown.
 * Multiple deployments of one script do not inflate the script-record counts. */
export function summarizeScriptMetadata(progress: ImpactScanProgress, metadata: AutomationResult) {
  const files = new Set(
    progress.results
      .filter((file) => file.source === 'script' && file.hits.length)
      .map((file) => file.fileId),
  );
  const scripts = new Map<
    string,
    { name: string; id: string; files: Set<string>; activity: Set<boolean | undefined> }
  >();
  const matched = new Set<string>();
  for (const item of metadata.items) {
    if (item.kind === 'workflow' || !item.scriptFileId || !files.has(item.scriptFileId)) continue;
    matched.add(item.scriptFileId);
    let script = scripts.get(item.internalId);
    if (!script) {
      script = { name: item.name, id: item.internalId, files: new Set(), activity: new Set() };
      scripts.set(item.internalId, script);
    }
    script.files.add(item.scriptFileId);
    script.activity.add(item.isInactive);
  }
  const counts = { enabled: 0, inactive: 0, unknown: 0 };
  const records = [...scripts.values()].map((script) => {
    const activity: 'enabled' | 'inactive' | 'unknown' =
      script.activity.size === 1 && script.activity.has(false)
        ? 'enabled'
        : script.activity.size === 1 && script.activity.has(true)
          ? 'inactive'
          : 'unknown';
    counts[activity]++;
    return { ...script, activity };
  });
  return { records, counts, unmatched: files.size - matched.size };
}
