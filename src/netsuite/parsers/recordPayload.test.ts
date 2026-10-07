import { describe, expect, it } from 'vitest';
import { readFixture } from '../../test/fixtures';
import { MAX_RECORD_XML_LENGTH, readRecordPayload } from './recordPayload';

const ref = { recordType: 'salesorder', id: '1001' };

describe('readRecordPayload', () => {
  it.each([
    ['salesorder', '1001'],
    ['customer', '2001'],
    ['customrecord_suitelens_demo', '5'],
  ])('preserves the full %s payload, attributes and sublist lines', (recordType, id) => {
    const payload = readRecordPayload(readFixture(`records/${recordType}-${id}.xml`), {
      recordType,
      id,
    });
    const record = payload.json.content.find((part) => typeof part !== 'string');
    expect(record).toMatchObject({ name: 'record', attributes: { recordType, id } });
    expect(payload.xml).not.toContain('_csrf');
    expect(payload.xml).not.toContain('_eml_nkey_');
    const serialized = JSON.stringify(payload.json);
    if (recordType === 'salesorder') {
      expect(serialized).toContain('BATCH-A');
      expect(serialized).toContain('Fake Widget B');
    }
  });

  it('preserves long, empty, repeated and mixed text without coercion or truncation', () => {
    const long = 'a'.repeat(3000);
    const { xml, json } = readRecordPayload(
      `<record id="1"><memo>${long}</memo><empty/><repeat>001</repeat><repeat>F</repeat><mixed>Hello <b>world</b> !</mixed><![CDATA[<data>]]></record>`,
    );
    expect(xml).toContain(long);
    expect(json.content).toEqual([
      { name: 'memo', attributes: {}, content: [long] },
      { name: 'empty', attributes: {}, content: [] },
      { name: 'repeat', attributes: {}, content: ['001'] },
      { name: 'repeat', attributes: {}, content: ['F'] },
      {
        name: 'mixed',
        attributes: {},
        content: ['Hello ', { name: 'b', attributes: {}, content: ['world'] }, ' !'],
      },
      '<data>',
    ]);
  });

  it('removes nested credentials, credential attributes, named fields, comments and instructions', () => {
    const { xml, json } = readRecordPayload(
      `<?instruction secret="hidden"?><record password="hidden" perm="4"><!--hidden--><memo>safe</memo><machine name="item"><line session="hidden"><token>hidden</token><field id="secret">hidden</field><field name="password">hidden</field><quantity>2</quantity></line></machine><?instruction hidden?></record>`,
    );
    expect(xml).not.toContain('hidden');
    expect(xml).toContain('<quantity>2</quantity>');
    expect(JSON.stringify(json)).not.toContain('hidden');
    expect(json.attributes).toEqual({ perm: '4' });
  });

  it.each([
    '<html><record/></html>',
    '<nsResponse/>',
    '<nsResponse><record/><record/></nsResponse>',
    '<record><broken></record>',
    '<!DOCTYPE record [<!ENTITY x "secret">]><record>&x;</record>',
    '<record/>'.repeat(MAX_RECORD_XML_LENGTH / 9 + 1),
    `<record>${'<nested>'.repeat(41)}value${'</nested>'.repeat(41)}</record>`,
    `<record>${'<field/>'.repeat(10_001)}</record>`,
  ])('rejects invalid or excessive XML (%#)', (xml) => {
    expect(() => readRecordPayload(xml)).toThrow(
      expect.objectContaining({ code: 'XML_UNAVAILABLE' }),
    );
  });

  it('checks record identity when returned and tolerates missing optional attributes', () => {
    expect(() => readRecordPayload('<record recordType="customer" id="1001"/>', ref)).toThrow(
      'different record',
    );
    expect(() => readRecordPayload('<record recordtype="salesorder" id="2"/>', ref)).toThrow(
      'different record',
    );
    expect(readRecordPayload('<record recordtype="SALESORDER" id="1001"/>', ref).json.name).toBe(
      'record',
    );
    expect(readRecordPayload('<record/>', ref).json.name).toBe('record');
  });
});

it('requires verifiable record identity for comparison responses', () => {
  expect(() => readRecordPayload('<record/>', ref, undefined, true)).toThrow(
    'verifiable record identity',
  );
  expect(
    readRecordPayload('<record recordType="salesorder" id="1001"/>', ref, undefined, true).json
      .name,
  ).toBe('record');
});
