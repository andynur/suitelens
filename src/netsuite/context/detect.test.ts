import { describe, expect, it } from 'vitest';
import { detectFromUrl, isRecordPage, refineWithBridge, refineWithDom } from './detect';
import { findMappingByPath, findMappingByType, RECORD_TYPE_MAP } from './recordTypeMap';

const HOST = 'https://1234567-sb1.app.netsuite.com';
const NOW = 1_700_000_000_000;

describe('detectFromUrl', () => {
  it('detects a sales order in view mode', () => {
    const url = `${HOST}/app/accounting/transactions/salesord.nl?id=1001&whence=`;
    expect(detectFromUrl(url, NOW)).toEqual({
      accountId: '1234567-sb1',
      environment: 'sandbox',
      pageKind: 'record_view',
      recordType: 'salesorder',
      recordTypeSource: 'url',
      recordId: '1001',
      url,
      detectedAt: NOW,
    });
  });

  it('detects edit and create modes', () => {
    expect(detectFromUrl(`${HOST}/app/common/entity/custjob.nl?id=5&e=T`)?.pageKind).toBe(
      'record_edit',
    );
    const create = detectFromUrl(`${HOST}/app/common/entity/custjob.nl`);
    expect(create?.pageKind).toBe('record_create');
    expect(create?.recordId).toBeUndefined();
  });

  it('maps every entry of the record type table', () => {
    for (const m of RECORD_TYPE_MAP) {
      const ctx = detectFromUrl(`${HOST}${m.path}?id=1`);
      expect(ctx?.recordType, m.path).toBe(m.recordType);
    }
  });

  it('is case-insensitive for the path', () => {
    expect(detectFromUrl(`${HOST}/app/accounting/transactions/SalesOrd.nl?id=1`)?.recordType).toBe(
      'salesorder',
    );
  });

  it('keeps the numeric custom record type ID', () => {
    const ctx = detectFromUrl(`${HOST}/app/common/custom/custrecordentry.nl?rectype=123&id=5`);
    expect(ctx).toMatchObject({
      pageKind: 'record_view',
      customRecordTypeId: '123',
      recordId: '5',
    });
    expect(ctx?.recordType).toBeUndefined();
    const createCtx = detectFromUrl(`${HOST}/app/common/custom/custrecordentry.nl?rectype=abc`);
    expect(createCtx?.pageKind).toBe('record_create');
    expect(createCtx?.customRecordTypeId).toBeUndefined();
  });

  it('treats item and generic transaction pages as records of unknown type', () => {
    const item = detectFromUrl(`${HOST}/app/common/item/item.nl?id=77`);
    expect(item).toMatchObject({ pageKind: 'record_view', recordId: '77' });
    expect(item?.recordType).toBeUndefined();
    expect(detectFromUrl(`${HOST}/app/accounting/transactions/transaction.nl`)?.pageKind).toBe(
      'record_create',
    );
  });

  it.each([
    ['/app/common/search/searchresults.nl?searchid=12', 'search'],
    ['/app/common/search/search.nl', 'search'],
    ['/app/common/search/savedsearch.nl?id=1', 'search'],
    ['/app/accounting/transactions/transactionlist.nl', 'list'],
    ['/app/center/card.nl?sc=-29', 'other'],
  ])('classifies %s as %s', (path, kind) => {
    expect(detectFromUrl(`${HOST}${path}`)?.pageKind).toBe(kind);
  });

  it('ignores invalid record IDs', () => {
    expect(detectFromUrl(`${HOST}/app/accounting/transactions/salesord.nl?id=abc`)?.pageKind).toBe(
      'record_create',
    );
  });

  it('returns undefined for non-NetSuite or invalid URLs', () => {
    expect(
      detectFromUrl('https://example.com/app/accounting/transactions/salesord.nl?id=1'),
    ).toBeUndefined();
    expect(detectFromUrl('http://1234567.app.netsuite.com/')).toBeUndefined();
    expect(detectFromUrl('::nope::')).toBeUndefined();
  });

  it('uses Date.now when no timestamp is given', () => {
    expect(detectFromUrl(`${HOST}/`)?.detectedAt).toBeGreaterThan(0);
  });
});

describe('refineWithDom', () => {
  const base = detectFromUrl(`${HOST}/app/common/custom/custrecordentry.nl?rectype=123&id=5`)!;

  it('fills the record type from the DOM', () => {
    expect(
      refineWithDom(base, { baseRecordType: 'CustomRecord_SuiteLens_Demo', recordId: '5' }),
    ).toMatchObject({
      recordType: 'customrecord_suitelens_demo',
      recordTypeSource: 'dom',
    });
  });

  it('does not override URL values and rejects junk', () => {
    const so = detectFromUrl(`${HOST}/app/accounting/transactions/salesord.nl?id=1`)!;
    expect(refineWithDom(so, { baseRecordType: 'invoice', recordId: '9' })).toEqual(so);
    expect(
      refineWithDom(base, { baseRecordType: '<script>', recordId: 'x' }).recordType,
    ).toBeUndefined();
    expect(refineWithDom(base, {}).recordType).toBeUndefined();
  });

  it('upgrades unknown pages to record pages when the DOM says so', () => {
    const other = detectFromUrl(`${HOST}/app/unknown/thing.nl`)!;
    expect(refineWithDom(other, { baseRecordType: 'job', recordId: '3' })).toMatchObject({
      pageKind: 'record_view',
      recordType: 'job',
      recordId: '3',
    });
    expect(refineWithDom(other, { baseRecordType: 'job', recordId: null }).pageKind).toBe(
      'record_create',
    );
  });
});

describe('refineWithBridge', () => {
  const item = detectFromUrl(`${HOST}/app/common/item/item.nl?id=77`)!;

  it('fills a missing record type', () => {
    expect(refineWithBridge(item, { recordType: 'inventoryitem', recordId: '77' })).toMatchObject({
      recordType: 'inventoryitem',
      recordTypeSource: 'bridge',
    });
    const create = detectFromUrl(`${HOST}/app/common/item/item.nl`)!;
    expect(refineWithBridge(create, { recordType: 'inventoryitem', recordId: '8' }).recordId).toBe(
      '8',
    );
  });

  it('keeps an existing record type and ignores invalid values', () => {
    const so = detectFromUrl(`${HOST}/app/accounting/transactions/salesord.nl?id=1`)!;
    expect(refineWithBridge(so, { recordType: 'invoice' })).toBe(so);
    expect(refineWithBridge(item, { recordType: null })).toBe(item);
  });
});

describe('isRecordPage and mapping lookups', () => {
  it('works', () => {
    expect(isRecordPage(null)).toBe(false);
    expect(isRecordPage(detectFromUrl(`${HOST}/app/center/card.nl`))).toBe(false);
    expect(isRecordPage(detectFromUrl(`${HOST}/app/common/entity/vendor.nl?id=1`))).toBe(true);
    expect(findMappingByPath('/APP/COMMON/ENTITY/VENDOR.NL')?.recordType).toBe('vendor');
    expect(findMappingByType('SalesOrder')?.label).toBe('Sales Order');
    expect(findMappingByType('nope')).toBeUndefined();
  });
});
