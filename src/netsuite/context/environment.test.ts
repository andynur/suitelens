import { describe, expect, it } from 'vitest';
import { isNetSuiteUrl, isValidAccountId, parseNetSuiteHost } from './environment';

describe('parseNetSuiteHost', () => {
  it.each([
    ['1234567.app.netsuite.com', '1234567', 'production'],
    ['1234567-sb1.app.netsuite.com', '1234567-sb1', 'sandbox'],
    ['1234567-SB2.app.netsuite.com', '1234567-sb2', 'sandbox'],
    ['1234567-rp.app.netsuite.com', '1234567-rp', 'release_preview'],
    ['TSTDRV123.app.netsuite.com', 'tstdrv123', 'production'],
  ])('%s → %s (%s)', (host, accountId, environment) => {
    expect(parseNetSuiteHost(host)).toEqual({ accountId, environment });
  });

  it.each([
    'system.netsuite.com',
    'app.netsuite.com',
    '1234567.app.netsuite.com.evil.com',
    'evil.com',
    '1234567-xx.app.netsuite.com',
    '1234567.extforms.netsuite.com',
  ])('rejects %s', (host) => {
    expect(parseNetSuiteHost(host)).toBeUndefined();
  });
});

describe('isNetSuiteUrl', () => {
  it('accepts https NetSuite account URLs only', () => {
    expect(isNetSuiteUrl('https://1234567.app.netsuite.com/app/center/card.nl')).toBe(true);
    expect(isNetSuiteUrl('http://1234567.app.netsuite.com/')).toBe(false);
    expect(isNetSuiteUrl('https://example.com/')).toBe(false);
    expect(isNetSuiteUrl('not a url')).toBe(false);
    expect(isNetSuiteUrl(undefined)).toBe(false);
  });
});

describe('isValidAccountId', () => {
  it('accepts normalized IDs and rejects key-breaking values', () => {
    expect(isValidAccountId('1234567')).toBe(true);
    expect(isValidAccountId('1234567-sb1')).toBe(true);
    expect(isValidAccountId('1234567-rp')).toBe(true);
    expect(isValidAccountId('1234567:settings')).toBe(false);
    expect(isValidAccountId('')).toBe(false);
    expect(isValidAccountId('ABC')).toBe(false);
  });
});
