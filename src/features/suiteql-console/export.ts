import type { ConsoleResult } from '../../netsuite/queries/console';
export type ExportFormat = 'csv' | 'json' | 'markdown';
/** CSV formula protection also covers leading control characters accepted by spreadsheet apps. */
function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && /^[\s]*[=+\-@]|^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function exportResults(rows: ConsoleResult['rows'], format: ExportFormat): string {
  if (format === 'json') return JSON.stringify(rows, null, 2);
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (format === 'csv')
    return (
      '\uFEFF' +
      [
        columns.map(csvCell).join(','),
        ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(',')),
      ].join('\r\n')
    );
  const cell = (value: unknown) =>
    value === null
      ? 'null'
      : String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\\/g, '\\\\')
          .replace(/\|/g, '\\|')
          .replace(/[\r\n]+/g, '<br>');
  return [
    columns.map(cell),
    columns.map(() => '---'),
    ...rows.map((row) => columns.map((key) => cell(row[key]))),
  ]
    .map((row) => `| ${row.join(' | ')} |`)
    .join('\n');
}
export { downloadLocal } from '../../shared/ui/download';
