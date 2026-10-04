import { describe, expect, it } from 'vitest';
import type { RecordFieldInfo } from '../../netsuite/types';
import { formatFieldCopy } from './copy';
import { EMPTY_FILTERS, filterFields } from './filter';

const f = (id: string, extra: Partial<RecordFieldInfo> = {}): RecordFieldInfo => ({
  id,
  custom: false,
  sources: ['xml'],
  ...extra,
});
const fields = [
  f('memo', { label: 'Memo', value: 'hello' }),
  f('entity', { label: 'Customer', mandatory: true, value: '1' }),
  f('custbody_x', { label: 'SuiteLens X', custom: true }),
  f('custbody_memo_ext', { label: 'Extra', custom: true, value: '' }),
];

describe('filterFields', () => {
  it('searches label and ID, case-insensitive', () => {
    expect(filterFields(fields, { ...EMPTY_FILTERS, query: 'MEMO' }).map((x) => x.id)).toEqual([
      'memo',
      'custbody_memo_ext',
    ]);
    expect(filterFields(fields, { ...EMPTY_FILTERS, query: 'customer' }).map((x) => x.id)).toEqual([
      'entity',
    ]);
    expect(filterFields(fields, EMPTY_FILTERS)).toHaveLength(4);
  });

  it('applies custom/mandatory/non-empty filters', () => {
    expect(filterFields(fields, { ...EMPTY_FILTERS, customOnly: true }).map((x) => x.id)).toEqual([
      'custbody_x',
      'custbody_memo_ext',
    ]);
    expect(
      filterFields(fields, { ...EMPTY_FILTERS, mandatoryOnly: true }).map((x) => x.id),
    ).toEqual(['entity']);
    expect(filterFields(fields, { ...EMPTY_FILTERS, nonEmptyOnly: true }).map((x) => x.id)).toEqual(
      ['memo', 'entity'],
    );
  });

  it('searches 300 fields in well under 100 ms', () => {
    const many = Array.from({ length: 300 }, (_, i) =>
      f(`custbody_field_${i}`, { label: `Field ${i}` }),
    );
    many.push(f('memo', { label: 'Memo' }));
    const start = performance.now();
    const out = filterFields(many, { ...EMPTY_FILTERS, query: 'memo' });
    expect(performance.now() - start).toBeLessThan(100);
    expect(out.map((x) => x.id)).toEqual(['memo']);
  });
});

describe('formatFieldCopy', () => {
  it('formats every copy option', () => {
    expect(formatFieldCopy('memo', 'id')).toBe('memo');
    expect(formatFieldCopy('memo', 'quoted')).toBe("'memo'");
    expect(formatFieldCopy('memo', 'snippet')).toBe("rec.getValue({ fieldId: 'memo' })");
    expect(formatFieldCopy('quantity', 'snippet', 'item')).toBe(
      "rec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: 0 })",
    );
  });
});
