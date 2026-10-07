import { useEffect, useState } from 'react';
import { getLocale, t } from './i18n';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "just now", "5 minutes ago", "yesterday" … in the active locale. */
export function formatRelativeTime(then: number, now: number): string {
  const diff = then - now;
  if (Math.abs(diff) < 60_000) return t('time.justNow');
  const format = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return format.format(Math.round(diff / ms), unit);
  }
  return t('time.justNow');
}

/** Current time that re-renders the caller every `intervalMs` (relative timestamps). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

/**
 * Epoch milliseconds of a wall-clock time ("YYYY-MM-DD HH:MM:SS") in an IANA time zone, or
 * undefined for a malformed time or zone. A time skipped by a DST change resolves to the
 * nearest valid instant.
 */
export function zonedTimeToEpoch(wall: string, timeZone: string): number | undefined {
  const match = WALL_TIME.exec(wall);
  if (!match) return undefined;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  try {
    // Two passes: the offset at the first guess can differ across a DST change.
    let epoch = asUtc - zoneOffset(asUtc, timeZone);
    epoch = asUtc - zoneOffset(epoch, timeZone);
    return epoch;
  } catch {
    return undefined;
  }
}

/** Offset of a time zone from UTC at an instant, in milliseconds. */
function zoneOffset(epoch: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(epoch));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  const local = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return local - Math.floor(epoch / 1000) * 1000;
}
