import type { ConsoleResult } from '../../netsuite/queries/console';

export type ResultRow = ConsoleResult['rows'][number];
export type ResultSort = { column: string; direction: 'ascending' | 'descending' };

export function resultColumns(rows: ResultRow[]): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))];
}

/** Null/missing values stay last in both directions; ties retain query order. */
export function sortResults(rows: ResultRow[], sort?: ResultSort): ResultRow[] {
  if (!sort) return rows;
  const collator = new Intl.Collator('en', { numeric: true });
  return rows.toSorted((left, right) => {
    const a = left[sort.column];
    const b = right[sort.column];
    if (a == null) return b == null ? 0 : 1;
    if (b == null) return -1;
    const comparison =
      typeof a === 'number' && typeof b === 'number'
        ? a - b
        : typeof a === 'boolean' && typeof b === 'boolean'
          ? Number(a) - Number(b)
          : collator.compare(String(a), String(b));
    return sort.direction === 'ascending' ? comparison : -comparison;
  });
}

export function resultCellText(value: ResultRow[string] | undefined): string {
  return value == null ? 'null' : String(value);
}

/** JSON preserves types and safely escapes tabs/newlines in copied rows. */
export function resultRowText(row: ResultRow, columns: string[]): string {
  return JSON.stringify(Object.fromEntries(columns.map((column) => [column, row[column] ?? null])));
}
