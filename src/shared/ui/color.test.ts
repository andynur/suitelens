import { describe, expect, it } from 'vitest';
import { DEFAULT_ENV_COLORS } from '../storage/settings';
import { readableTextOn } from './color';

describe('readableTextOn', () => {
  it('uses white text on dark backgrounds', () => {
    expect(readableTextOn('#000000')).toBe('#ffffff');
    expect(readableTextOn(DEFAULT_ENV_COLORS.production)).toBe('#ffffff');
    expect(readableTextOn(DEFAULT_ENV_COLORS.release_preview)).toBe('#ffffff');
  });

  it('uses dark text on light backgrounds', () => {
    expect(readableTextOn('#ffffff')).toBe('#1f1f21');
    expect(readableTextOn('#fbc828')).toBe('#1f1f21');
    expect(readableTextOn(DEFAULT_ENV_COLORS.sandbox)).toBe('#1f1f21');
  });

  it('falls back to white for invalid input', () => {
    expect(readableTextOn('red')).toBe('#ffffff');
    expect(readableTextOn('')).toBe('#ffffff');
  });
});
