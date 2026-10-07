import { z } from 'zod';
import type { MetadataTable } from '../../shared/storage/consoleLibrary';

/** Modular sources. VERIFY table/column visibility per role in Records Catalog.
 * Probe one row only; discard all values and retain identifier names.
 * This is an incremental partial index, never a claim of a complete account catalog.
 */
export const METADATA_SOURCES = [
  { id: 'transaction', sql: 'SELECT * FROM transaction WHERE ROWNUM <= 1 ORDER BY id' },
  { id: 'customer', sql: 'SELECT * FROM customer WHERE ROWNUM <= 1 ORDER BY id' },
  { id: 'item', sql: 'SELECT * FROM item WHERE ROWNUM <= 1 ORDER BY id' },
  { id: 'customrecordtype', sql: 'SELECT scriptid FROM customrecordtype ORDER BY scriptid' },
  {
    id: 'customfield',
    sql: 'SELECT cf.scriptid, cf.recordtype, crt.scriptid AS tablename FROM customfield cf LEFT JOIN customrecordtype crt ON crt.internalid = cf.recordtype ORDER BY cf.scriptid',
  },
] as const;
export function mapMetadata(source: string, rows: Record<string, unknown>[]): MetadataTable[] {
  if (source === 'customrecordtype')
    return rows.map((row) => ({
      name: z
        .string()
        .regex(/^customrecord_[a-z0-9_]+$/i)
        .parse(row.scriptid)
        .toLowerCase(),
      columns: ['id'],
      source: 'custom' as const,
    }));
  if (source === 'customfield') {
    const tables: MetadataTable[] = [];
    for (const row of rows) {
      const column = z
        .string()
        .regex(/^[a-z][a-z0-9_]*$/i)
        .parse(row.scriptid)
        .toLowerCase();
      const customTable =
        typeof row.tablename === 'string' && /^customrecord_[a-z0-9_]+$/i.test(row.tablename)
          ? row.tablename.toLowerCase()
          : undefined;
      const table =
        customTable ??
        (column.startsWith('custbody_')
          ? 'transaction'
          : column.startsWith('custcol_')
            ? 'transactionline'
            : column.startsWith('custitem_')
              ? 'item'
              : undefined);
      if (table) tables.push({ name: table, columns: [column], source: 'custom' });
    }
    return mergeMetadata([], tables);
  }
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) =>
    /^[a-z][a-z0-9_]*$/i.test(key),
  );
  return columns.length ? [{ name: source, columns, source: 'observed' }] : [];
}
export function mergeMetadata(previous: MetadataTable[], incoming: MetadataTable[]) {
  const tables = new Map(previous.map((table) => [table.name, table]));
  for (const table of incoming) {
    const old = tables.get(table.name);
    tables.set(table.name, {
      ...table,
      columns: [...new Set([...(old?.columns ?? []), ...table.columns])],
    });
  }
  return [...tables.values()];
}
