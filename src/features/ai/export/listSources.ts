import type { NetSuiteAdapter } from '../../../netsuite/adapter/NetSuiteAdapter';
import { SuiteLensError } from '../../../netsuite/errors';
import {
  CONTEXT_SOURCE_BATCH,
  contextFieldsSql,
  contextRecordNamesSql,
  contextCustomRecordsSql,
  mapContextFields,
  mapContextRecordNames,
  mapContextCustomRecords,
  resolveContextSources,
} from '../../../netsuite/queries/contextSources';
import type { RecordFieldsResult } from '../../../netsuite/types';

/** On-demand metadata only, bounded to active custom body/column fields. No option reads. */
export async function loadContextListSources(
  adapter: NetSuiteAdapter,
  accountId: string,
  fields: RecordFieldsResult,
  signal?: AbortSignal,
) {
  const ids = [
    ...new Set(
      [...fields.fields, ...fields.sublists.flatMap((s) => s.fields)]
        .map((f) => f.id.toUpperCase())
        .filter((id) => /^CUST(BODY|COL)_[A-Z0-9_]+$/.test(id)),
    ),
  ];
  const capped = ids.length > CONTEXT_SOURCE_BATCH;
  const selected = ids.slice(0, CONTEXT_SOURCE_BATCH);
  const read = async (sql: string, params: (string | number)[]) => {
    if (signal?.aborted) throw new SuiteLensError('CANCELLED', 'Export cancelled.');
    const result = await adapter.runSuiteQL(sql, { accountId, params, signal, maxRows: 1_000 });
    if (signal?.aborted) throw new SuiteLensError('CANCELLED', 'Export cancelled.');
    if (result.accountId !== accountId)
      throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed during export.');
    if (result.atLimit)
      throw new SuiteLensError('UNSUPPORTED', 'List-source metadata was truncated.');
    return result.rows;
  };
  if (!selected.length) return { sources: {}, capped };
  const definitions = mapContextFields(
    await read(contextFieldsSql(selected.length), selected),
  ).filter(
    (f) =>
      selected.includes(f.scriptid.toUpperCase()) &&
      (f.fieldtype === 'BODY'
        ? f.scriptid.startsWith('custbody_')
        : f.scriptid.startsWith('custcol_')),
  );
  const labels = [...new Set(definitions.flatMap((f) => (f.source_label ? [f.source_label] : [])))];
  const positiveIds = [
    ...new Set(
      definitions.flatMap((f) =>
        f.fieldvaluetyperecord !== null && f.fieldvaluetyperecord > 0
          ? [f.fieldvaluetyperecord]
          : [],
      ),
    ),
  ];
  const records = positiveIds.length
    ? mapContextCustomRecords(await read(contextCustomRecordsSql(positiveIds.length), positiveIds))
    : [];
  const names = labels.length
    ? mapContextRecordNames(await read(contextRecordNamesSql(labels.length), labels))
    : [];
  return { sources: resolveContextSources(definitions, names, records), capped };
}
