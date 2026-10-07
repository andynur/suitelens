import { describe, expect, it } from 'vitest';
import { formatRelativeTime, zonedTimeToEpoch } from './time';

const NOW = Date.UTC(2026, 9, 4, 12, 0, 0);

describe('formatRelativeTime', () => {
  it('says "just now" under a minute', () => {
    expect(formatRelativeTime(NOW - 20_000, NOW)).toBe('just now');
  });

  it('uses the largest whole unit', () => {
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe('5 minutes ago');
    expect(formatRelativeTime(NOW - 3 * 3_600_000, NOW)).toBe('3 hours ago');
    expect(formatRelativeTime(NOW - 86_400_000, NOW)).toBe('yesterday');
  });
});

describe('zonedTimeToEpoch', () => {
  it('converts account wall time in a named zone', () => {
    expect(zonedTimeToEpoch('2026-01-15 09:30:00', 'America/Los_Angeles')).toBe(
      Date.UTC(2026, 0, 15, 17, 30, 0),
    );
    expect(zonedTimeToEpoch('2026-07-15 09:30:00', 'America/Los_Angeles')).toBe(
      Date.UTC(2026, 6, 15, 16, 30, 0),
    );
    expect(zonedTimeToEpoch('2026-07-15 09:30:00', 'Asia/Jakarta')).toBe(
      Date.UTC(2026, 6, 15, 2, 30, 0),
    );
  });

  it('rejects malformed times and zones', () => {
    expect(zonedTimeToEpoch('2026-07-15T09:30', 'UTC')).toBeUndefined();
    expect(zonedTimeToEpoch('2026-07-15 09:30:00', 'Not/AZone')).toBeUndefined();
  });
});
