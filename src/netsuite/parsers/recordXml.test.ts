import { describe, expect, it } from 'vitest';
import { readFixture } from '../../test/fixtures';
import { SuiteLensError } from '../errors';
import { buildRecordXmlUrl, parseRecordXml } from './recordXml';

describe('parseRecordXml', () => {
  it('parses body fields and sublists of the sales order fixture', () => {
    const parsed = parseRecordXml(readFixture('records/salesorder-1001.xml'));
    expect(parsed.recordType).toBe('salesorder');
    expect(parsed.id).toBe('1001');
    expect(parsed.fields.find((f) => f.id === 'memo')?.value).toBe(
      'Fake order for SuiteLens fixtures',
    );
    expect(parsed.fields.map((f) => f.id)).not.toContain('machine');
    const item = parsed.sublists.find((s) => s.id === 'item');
    expect(item?.lineCount).toBe(2);
    expect(item?.fieldIds).toEqual([
      'item',
      'description',
      'quantity',
      'rate',
      'amount',
      'custcol_suitelens_batch',
    ]);
    expect(parsed.sublists.map((s) => s.id)).toEqual(['item', 'salesteam']);
  });

  it('drops session token fields such as _csrf and _eml_nkey_', () => {
    const parsed = parseRecordXml(readFixture('records/salesorder-1001.xml'));
    const ids = parsed.fields.map((f) => f.id);
    expect(ids).not.toContain('_csrf');
    expect(ids).not.toContain('_eml_nkey_');
    expect(JSON.stringify(parsed)).not.toContain('FAKE-CSRF-TOKEN');
  });

  it('drops token columns in sublists', () => {
    const xml = `<nsResponse><record recordtype="x" id="1">
      <machine name="lines" fields="_csrf,a"><line><a>1</a><_tok>2</_tok></line></machine>
      </record></nsResponse>`;
    expect(parseRecordXml(xml).sublists[0]?.fieldIds).toEqual(['a']);
  });

  it('parses the custom record fixture', () => {
    const parsed = parseRecordXml(readFixture('records/customrecord_suitelens_demo-5.xml'));
    expect(parsed.recordType).toBe('customrecord_suitelens_demo');
    expect(parsed.sublists).toEqual([]);
  });

  it('uses the machine `fields` attribute and dedupes columns', () => {
    const xml = `<nsResponse><record recordtype="x" id="1"><memo>a</memo><memo>b</memo>
      <machine name="Lines" fields="a, b"><line><b>1</b><c>2</c></line></machine>
      <machine><line/></machine></record></nsResponse>`;
    const parsed = parseRecordXml(xml);
    expect(parsed.recordType).toBe('x');
    expect(parsed.fields).toEqual([{ id: 'memo', value: 'a' }]);
    expect(parsed.sublists).toEqual([{ id: 'lines', lineCount: 1, fieldIds: ['a', 'b', 'c'] }]);
  });

  it('truncates very long values', () => {
    const long = 'x'.repeat(3000);
    const parsed = parseRecordXml(`<record><memo>${long}</memo></record>`);
    expect(parsed.fields[0]?.value.length).toBe(2001);
    expect(parsed.recordType).toBeUndefined();
    expect(parsed.id).toBeUndefined();
  });

  it('rejects an HTML login page', () => {
    expect(() => parseRecordXml('<!doctype html><html><body>Login</body></html>')).toThrowError(
      SuiteLensError,
    );
    try {
      parseRecordXml('<html></html>');
    } catch (err) {
      expect((err as SuiteLensError).code).toBe('XML_UNAVAILABLE');
    }
  });

  it('rejects malformed XML and XML without a record', () => {
    expect(() => parseRecordXml('<?xml version="1.0"?><nsResponse><record>')).toThrow(/parsed/);
    expect(() => parseRecordXml('<?xml version="1.0"?><nsResponse><error/></nsResponse>')).toThrow(
      /no record/,
    );
  });
});

describe('buildRecordXmlUrl', () => {
  it('keeps only identifying parameters and adds xml=T', () => {
    expect(
      buildRecordXmlUrl(
        'https://1234567.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001&e=T&whence=',
      ),
    ).toBe(
      'https://1234567.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001&xml=T',
    );
    expect(
      buildRecordXmlUrl(
        'https://1234567.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=123&id=5',
      ),
    ).toBe(
      'https://1234567.app.netsuite.com/app/common/custom/custrecordentry.nl?id=5&rectype=123&xml=T',
    );
  });
});
