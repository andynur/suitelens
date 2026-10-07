import { expect, it } from 'vitest';
import { exportResults } from './export';
it('writes BOM UTF-8 CSV, quoted multiline cells and safe spreadsheet formulas', () => {
  const csv = exportResults(
    [{ name: '日本, café', memo: '"line"\nnext', formula: ' =SUM(A1)', number: -5, blank: null }],
    'csv',
  );
  expect(csv.startsWith('\uFEFF')).toBe(true);
  expect(csv).toContain('"日本, café"');
  expect(csv).toContain('""line""\nnext');
  expect(csv).toContain("' =SUM(A1)");
  expect(csv).toContain('"-5"');
});
it('preserves typed JSON and escapes Markdown data', () => {
  const rows = [{ id: 1, active: true, empty: null, text: 'a|b\n<script>' }];
  expect(JSON.parse(exportResults(rows, 'json'))).toEqual(rows);
  expect(exportResults(rows, 'markdown')).toContain('a\\|b<br>&lt;script&gt;');
  expect(exportResults(rows, 'markdown')).toContain('null');
});
