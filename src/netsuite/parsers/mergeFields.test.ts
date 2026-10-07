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
    // Form fields first (page order), then the rest in record data order.
    expect(out.fields.map((f) => f.id)).toEqual(['memo', 'custbody_dom', 'entity', 'custpage_x']);
    expect(out.fields[0]).toEqual({
      id: 'memo',
      label: 'Memo',
      type: 'textarea',
      value: 'xml memo',
      mandatory: false,
      custom: false,
      sources: ['xml', 'dom', 'currentRecord'],
    });
    expect(out.fields[2]?.value).toBe('ACME (fake)');
    expect(out.fields[1]).toMatchObject({ custom: true, mandatory: true, sources: ['dom'] });
    expect(out.fields[3]).toMatchObject({ hidden: true, disabled: true, custom: true });

    const item = out.sublists.find((s) => s.id === 'item');
    expect(item?.lineCount).toBe(3);
    expect(item?.fields.map((f) => f.id)).toEqual(['item', 'custcol_a', 'qty']);
    expect(item?.fields[0]).toMatchObject({ label: 'Item', sources: ['xml', 'currentRecord'] });
    expect(out.sublists.map((s) => s.id)).toEqual(['item', 'extra']);
  });

  it('never passes token fields through, whatever the source', () => {
    const out = mergeFieldSources({
      xml: {
        fields: [{ id: '_csrf', value: 'x' }],
        sublists: [{ id: 's', lineCount: 1, fieldIds: ['_k', 'a'] }],
      },
      domLabels: [{ id: '_eml_nkey_', label: 'k', mandatory: false }],
      currentRecord: {
        fields: [
          { id: 'sessiontoken', value: 'x' },
          { id: 'memo', value: 'm' },
        ],
        sublists: [{ id: 's', lineCount: 1, fields: [{ id: '_t' }] }],
      },
    });
    expect(out.fields.map((f) => f.id)).toEqual(['memo']);
    expect(out.sublists[0]?.fields.map((f) => f.id)).toEqual(['a']);
  });

  it('uses a loaded record only to fill types, default labels and display text', () => {
    const out = mergeFieldSources({
      xml: {
        fields: [
          { id: 'entity', value: '42' },
          { id: 'approvalstatus', value: '1' },
        ],
        sublists: [{ id: 'item', lineCount: 1, fieldIds: ['item'] }],
      },
      domLabels: [{ id: 'entity', label: 'Vendor', mandatory: true }],
      loadedRecord: {
        fields: [
          { id: 'entity', label: 'Entity', type: 'select', text: 'Able (fake)', mandatory: false },
          { id: 'approvalstatus', label: 'Approval Status', type: 'select', text: '' },
          { id: 'extra', label: 'Not in XML', type: 'text' },
        ],
        sublists: [
          { id: 'item', lineCount: 1, fields: [{ id: 'item', label: 'Item', type: 'select' }] },
          { id: 'unknown', lineCount: 1, fields: [{ id: 'x', type: 'text' }] },
        ],
      },
    });
    expect(out.sources).toEqual(['xml', 'dom', 'loadedRecord']);
    expect(out.fields).toEqual([
      {
        id: 'entity',
        label: 'Vendor',
        type: 'select',
        value: 'Able (fake)',
        mandatory: true,
        custom: false,
        sources: ['xml', 'dom', 'loadedRecord'],
      },
      {
        id: 'approvalstatus',
        label: 'Approval Status',
        type: 'select',
        value: '1',
        custom: false,
        sources: ['xml', 'loadedRecord'],
      },
    ]);
    expect(out.sublists).toEqual([
      {
        id: 'item',
        lineCount: 1,
        fields: [
          {
            id: 'item',
            label: 'Item',
            type: 'select',
            custom: false,
            sources: ['xml', 'loadedRecord'],
          },
        ],
      },
    ]);
  });

  it('handles empty input', () => {
    expect(mergeFieldSources({})).toEqual({ fields: [], sublists: [], sources: [] });
    expect(mergeFieldSources({ domLabels: [] }).sources).toEqual([]);
  });
});
