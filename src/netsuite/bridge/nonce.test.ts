import { describe, expect, it } from 'vitest';
import { createNonce, nonceEquals } from './nonce';

describe('nonce', () => {
  it('creates 32 hex chars and differs each time', () => {
    const a = createNonce();
    expect(a).toMatch(/^[a-f0-9]{32}$/);
    expect(createNonce()).not.toBe(a);
    expect(createNonce((b) => b.fill(255))).toBe('f'.repeat(32));
  });

  it('compares nonces', () => {
    expect(nonceEquals('abc', 'abc')).toBe(true);
    expect(nonceEquals('abc', 'abd')).toBe(false);
    expect(nonceEquals('abc', 'ab')).toBe(false);
  });
});
