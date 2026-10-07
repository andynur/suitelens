import { describe, expect, it } from 'vitest';
import {
  accountOrigin,
  buildRecordUrl,
  deploymentRecordUrl,
  fileCabinetUrl,
  scriptRecordUrl,
  workflowRecordUrl,
} from './urls';

describe('urls', () => {
  it('builds record URLs', () => {
    expect(
      buildRecordUrl('1234567-sb1', { kind: 'mapped', recordType: 'salesorder', id: '1001' }),
    ).toBe('https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001');
    expect(buildRecordUrl('1', { kind: 'transaction', id: '5' })).toBe(
      'https://1.app.netsuite.com/app/accounting/transactions/transaction.nl?id=5',
    );
    expect(buildRecordUrl('1', { kind: 'customrecord', customRecordTypeId: '123', id: '5' })).toBe(
      'https://1.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=123&id=5',
    );
  });

  it('rejects invalid input', () => {
    expect(
      buildRecordUrl('1', { kind: 'mapped', recordType: 'salesorder', id: '1;drop' }),
    ).toBeUndefined();
    expect(buildRecordUrl('1', { kind: 'mapped', recordType: 'nope', id: '1' })).toBeUndefined();
    expect(
      buildRecordUrl('1', { kind: 'customrecord', customRecordTypeId: 'x', id: '1' }),
    ).toBeUndefined();
    expect(() => accountOrigin('evil.com/x')).toThrow();
  });

  it('builds automation links', () => {
    expect(scriptRecordUrl('1', '101')).toBe(
      'https://1.app.netsuite.com/app/common/scripting/script.nl?id=101',
    );
    expect(deploymentRecordUrl('1', '201')).toContain('scriptrecord.nl?id=201');
    expect(fileCabinetUrl('1', '9001')).toContain('mediaitem.nl?id=9001');
    expect(workflowRecordUrl('1', '301')).toContain('id=301');
    expect(scriptRecordUrl('1', undefined)).toBeUndefined();
    expect(scriptRecordUrl('1', 'abc')).toBeUndefined();
  });
});
