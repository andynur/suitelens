import { describe, expect, it } from 'vitest';
import { isMessageKey, setLocale, t } from '.';
import { AUTOMATION_WARNINGS } from '../../netsuite/queries/runner';
import { RECORD_WARNINGS } from '../../netsuite/adapter/contentService';
import { ErrorCodeSchema } from '../../netsuite/errors';

describe('t()', () => {
  it('fills placeholders and keeps unknown ones', () => {
    expect(t('app.copied', { value: 'memo' })).toBe('Copied memo');
    expect(t('record.count', { shown: 1 })).toBe('1 of {total} fields');
    expect(t('tabs.record')).toBe('Record');
  });

  it('falls back to English for unknown locales', () => {
    setLocale('xx');
    expect(t('tabs.record')).toBe('Record');
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
