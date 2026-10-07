import { useEffect, useState } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { isRecordPage } from '../../netsuite/context/detect';
import type { PageContext } from '../../netsuite/types';

/**
 * Custom field IDs of the current record for the Impact typeahead. Reuses the Record tab's
 * read (`getRecordFields`); only IDs are kept, never values. Failures leave the list empty.
 */
export function useFieldSuggestions(adapter: NetSuiteAdapter, context: PageContext): string[] {
  const [ids, setIds] = useState<{ key: string; ids: string[] }>();
  const recordType = isRecordPage(context) ? context.recordType : undefined;
  const key = JSON.stringify([adapter.kind, context.accountId, recordType, context.recordId]);
  useEffect(() => {
    if (!recordType) return;
    let live = true;
    const ref = context.recordId ? { recordType, id: context.recordId } : { recordType };
    adapter
      .getRecordFields(ref)
      .then((result) => {
        if (!live || result.accountId !== context.accountId) return;
        const all = [...result.fields, ...result.sublists.flatMap((sublist) => sublist.fields)];
        const custom = [...new Set(all.filter((field) => field.custom).map((field) => field.id))];
        setIds({ key, ids: custom.sort() });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [adapter, context.accountId, context.recordId, recordType, key]);
  return ids?.key === key ? ids.ids : [];
}
