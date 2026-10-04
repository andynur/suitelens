import { describe, expect, it } from 'vitest';
import { loadFixturePage } from '../../test/fixtures';
import { fieldIdFromLabelElement, readDomSignals, readFieldLabels } from './formDom';

describe('readFieldLabels', () => {
  it('reads labels and mandatory markers from the sales order page', () => {
    const labels = readFieldLabels(loadFixturePage('salesorder-view.html'));
    expect(labels.find((l) => l.id === 'memo')).toEqual({
      id: 'memo',
      label: 'Memo',
      mandatory: false,
    });
    expect(labels.find((l) => l.id === 'entity')).toEqual({
      id: 'entity',
      label: 'Customer',
      mandatory: true,
    });
    expect(labels.find((l) => l.id === 'custbody_loupe_priority')?.mandatory).toBe(true);
  });

  it('ignores injected badges, duplicates and invalid IDs', () => {
    const doc = new DOMParser().parseFromString(
      `<span id="memo_fs_lbl">Memo <span data-loupe="field-id">memo</span></span>
       <span id="memo_fs_lbl">Dup</span>
       <span id="bad-id_fs_lbl">Bad</span>`,
      'text/html',
    );
    expect(readFieldLabels(doc)).toEqual([{ id: 'memo', label: 'Memo', mandatory: false }]);
  });
});

describe('fieldIdFromLabelElement', () => {
  it('extracts the field id', () => {
    const doc = new DOMParser().parseFromString(
      '<span id="CustBody_X_fs_lbl"></span><span id="other"></span>',
      'text/html',
    );
    const [a, b] = Array.from(doc.querySelectorAll('span'));
    expect(fieldIdFromLabelElement(a!)).toBe('custbody_x');
    expect(fieldIdFromLabelElement(b!)).toBeUndefined();
  });
});

describe('readDomSignals', () => {
  it('reads hidden record inputs', () => {
    expect(readDomSignals(loadFixturePage('customrecord-view.html'))).toEqual({
      baseRecordType: 'customrecord_loupe_demo',
      recordId: '5',
    });
    expect(readDomSignals(loadFixturePage('list.html'))).toEqual({
      baseRecordType: null,
      recordId: null,
    });
  });
});
