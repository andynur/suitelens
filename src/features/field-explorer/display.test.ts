import { describe, expect, it } from 'vitest';
import type { RecordFieldInfo } from '../../netsuite/types';
import { displayValue, formatFieldValue, partitionByForm } from './display';

const field = (id: string, sources: RecordFieldInfo['sources']): RecordFieldInfo => ({
  id,
  custom: false,
  sources,
});

describe('partitionByForm', () => {
  it('separates fields with a page label from the rest', () => {
    const groups = partitionByForm(
      [field('entity', ['xml', 'dom']), field('baserecordtype', ['xml']), field('memo', ['dom'])],
      true,
    );
    expect(groups.onForm.map((f) => f.id)).toEqual(['entity', 'memo']);
    expect(groups.notOnForm.map((f) => f.id)).toEqual(['baserecordtype']);
  });

  it('still splits when the filtered list has no form field left', () => {
    const groups = partitionByForm([field('billaddress', ['xml'])], true);
    expect(groups.notOnForm.map((f) => f.id)).toEqual(['billaddress']);
  });

  it('keeps everything together when the page gave no labels', () => {
    const groups = partitionByForm([field('a', ['xml']), field('b', ['currentRecord'])], false);
    expect(groups.onForm).toHaveLength(2);
    expect(groups.notOnForm).toEqual([]);
  });
});

describe('displayValue', () => {
  it('turns literal <br> tags into line breaks', () => {
    expect(displayValue('Able Co.<br>155 Waterloo Road,<BR/>Kowloon')).toBe(
      'Able Co.\n155 Waterloo Road,\nKowloon',
    );
    expect(displayValue('<b>kept as text</b>')).toBe('<b>kept as text</b>');
    expect(displayValue(undefined)).toBe('');
  });
});

describe('formatFieldValue', () => {
  it('shows checkbox T/F as Yes/No and keeps other values', () => {
    expect(formatFieldValue({ type: 'checkbox', value: 'T' })).toBe('✓ Yes');
    expect(formatFieldValue({ type: 'checkbox', value: 'F' })).toBe('✗ No');
    expect(formatFieldValue({ type: 'text', value: 'T' })).toBe('T');
    expect(formatFieldValue({ type: 'textarea', value: 'a<br>b' })).toBe('a\nb');
  });
});
