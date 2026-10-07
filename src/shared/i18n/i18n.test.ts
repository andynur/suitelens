import { describe, expect, it } from 'vitest';
import { isMessageKey, setLocale, t } from '.';
import { en } from './en';
import { AUTOMATION_WARNINGS } from '../../netsuite/queries/runner';
import { RECORD_WARNINGS } from '../../netsuite/adapter/contentService';
import { ErrorCodeSchema } from '../../netsuite/errors';

describe('t()', () => {
  it('fills placeholders and keeps unknown ones', () => {
    expect(t('app.copied', { value: 'memo' })).toBe('Copied memo');
    expect(t('app.copied', {})).toBe('Copied {value}');
    expect(t('tabs.record')).toBe('Fields');
  });

  it('picks plural forms and formats the number', () => {
    expect(t('logs.occurrences', { count: 1 })).toBe('1 occurrence');
    expect(t('logs.occurrences', { count: 1200 })).toBe('1,200 occurrences');
    expect(t('logs.count', { count: 1000, total: 1000 })).toBe('1,000 of 1,000 logs');
    expect(t('impact.planFromRecord', { count: 2 })).toBe('Scan in Impact (2 files)');
  });

  it('has no "{count} <plural noun>" strings without plural rules', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const value: string = en[key];
      expect(
        /\{\w+\} (?:files|refs|logs|occurrences|fields|rows|lines|scripts)\b/.test(value),
        key,
      ).toBe(false);
    }
  });

  it('falls back to English for unknown locales', () => {
    setLocale('xx');
    expect(t('tabs.record')).toBe('Fields');
    setLocale('en');
  });

  it('has a message for every error code and warning code', () => {
    for (const code of ErrorCodeSchema.options)
      expect(isMessageKey(`error.${code}`), code).toBe(true);
    for (const w of [...Object.values(AUTOMATION_WARNINGS), ...Object.values(RECORD_WARNINGS)]) {
      expect(isMessageKey(w), w).toBe(true);
    }
  });
});
