import { describe, expect, it } from 'vitest';
import { classifySuiteQLError, LoupeError, toLoupeError } from './errors';

describe('LoupeError', () => {
  it('round-trips through its shape', () => {
    const err = new LoupeError('TIMEOUT', 'slow', 'detail');
    expect(LoupeError.fromShape(err.toShape())).toMatchObject({
      code: 'TIMEOUT',
      message: 'slow',
      detail: 'detail',
    });
    expect(new LoupeError('UNKNOWN', 'x').toShape()).toEqual({ code: 'UNKNOWN', message: 'x' });
  });

  it('wraps unknown errors', () => {
    expect(toLoupeError(new Error('boom'))).toMatchObject({ code: 'UNKNOWN', message: 'boom' });
    expect(toLoupeError('text').message).toBe('text');
    const same = new LoupeError('TIMEOUT', 'x');
    expect(toLoupeError(same)).toBe(same);
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
