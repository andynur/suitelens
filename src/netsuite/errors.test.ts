import { describe, expect, it } from 'vitest';
import { classifySuiteQLError, SuiteLensError, toSuiteLensError } from './errors';

describe('SuiteLensError', () => {
  it('round-trips through its shape', () => {
    const err = new SuiteLensError('TIMEOUT', 'slow', 'detail');
    expect(SuiteLensError.fromShape(err.toShape())).toMatchObject({
      code: 'TIMEOUT',
      message: 'slow',
      detail: 'detail',
    });
    expect(new SuiteLensError('UNKNOWN', 'x').toShape()).toEqual({ code: 'UNKNOWN', message: 'x' });
  });

  it('wraps unknown errors', () => {
    expect(toSuiteLensError(new Error('boom'))).toMatchObject({ code: 'UNKNOWN', message: 'boom' });
    expect(toSuiteLensError('text').message).toBe('text');
    const same = new SuiteLensError('TIMEOUT', 'x');
    expect(toSuiteLensError(same)).toBe(same);
  });
});

describe('classifySuiteQLError', () => {
  it.each([
    ['You do not have permission to view this record', 'PERMISSION_DENIED'],
    ['INSUFFICIENT_PERMISSION', 'PERMISSION_DENIED'],
    ["Search error occurred: Unknown identifier 'loglevel'", 'TABLE_UNAVAILABLE'],
    ['Invalid or unsupported search', 'TABLE_UNAVAILABLE'],
    ['Something odd', 'QUERY_FAILED'],
  ])('%s → %s', (message, code) => {
    expect(classifySuiteQLError(message)).toBe(code);
  });
});
