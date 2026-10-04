import { describe, expect, it } from 'vitest';
import { isCustomFieldId, mergeFieldSources } from './mergeFields';

describe('isCustomFieldId', () => {
  it.each([
    ['custbody_x', true],
    ['custcol_x', true],
    ['custentity_x', true],
    ['custrecord_x', true],
    ['custitem_x', true],
    ['custevent_x', true],
    ['custpage_x', true],
    ['memo', false],
    ['customer', false],
    ['entity', false],
    ['customform', false],
    ['custbody', false],
  ])('%s → %s', (id, expected) => {
    expect(isCustomFieldId(id)).toBe(expected);
  });
});

describe('mergeFieldSources', () => {
  it('merges XML, DOM labels and currentRecord with the documented precedence', () => {
    const out = mergeFieldSources({
      xml: {
        fields: [
          { id: 'memo', value: 'xml memo' },
          { id: 'entity', value: '42' },
        ],
        sublists: [{ id: 'item', lineCount: 2, fieldIds: ['item', 'custcol_a'] }],
      },
      domLabels: [
        { id: 'memo', label: 'Memo (dom)', mandatory: false },
        { id: 'custbody_dom', label: 'Dom only', mandatory: true },
      ],
      currentRecord: {
        fields: [
          { id: 'memo', label: 'Memo', type: 'textarea', mandatory: false, text: '' },
          {
            id: 'entity',
            label: 'Customer',
            type: 'select',
            mandatory: true,
            value: '42',
            text: 'ACME (fake)',
          },
          { id: 'custpage_x', hidden: true, disabled: true },
        ],
        sublists: [
          {
            id: 'item',
            lineCount: 3,
            fields: [
              { id: 'item', label: 'Item', type: 'select' },
              { id: 'qty', label: 'Qty' },
            ],
          },
          { id: 'extra', lineCount: 0, fields: [{ id: 'a' }] },
        ],
      },
    });

    expect(out.sources).toEqual(['xml', 'dom', 'currentRecord']);
    expect(out.fields.map((f) => f.id)).toEqual(['memo', 'entity', 'custbody_dom', 'custpage_x']);
    expect(out.fields[0]).toEqual({
      id: 'memo',
      label: 'Memo',
      type: 'textarea',
      value: 'xml memo',
      mandatory: false,
      custom: false,
      sources: ['xml', 'dom', 'currentRecord'],
    });
    expect(out.fields[1]?.value).toBe('ACME (fake)');
    expect(out.fields[2]).toMatchObject({ custom: true, mandatory: true, sources: ['dom'] });
    expect(out.fields[3]).toMatchObject({ hidden: true, disabled: true, custom: true });

    const item = out.sublists.find((s) => s.id === 'item');
    expect(item?.lineCount).toBe(3);
    expect(item?.fields.map((f) => f.id)).toEqual(['item', 'custcol_a', 'qty']);
    expect(item?.fields[0]).toMatchObject({ label: 'Item', sources: ['xml', 'currentRecord'] });
    expect(out.sublists.map((s) => s.id)).toEqual(['item', 'extra']);
  });

  it('handles empty input', () => {
    expect(mergeFieldSources({})).toEqual({ fields: [], sublists: [], sources: [] });
    expect(mergeFieldSources({ domLabels: [] }).sources).toEqual([]);
  });
});
