import { describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getGotoHistory, pushGotoHistory } from './gotoHistory';
import {
  accountKey,
  clearAllStorage,
  DEFAULT_SETTINGS,
  getAccountSettings,
  getSettings,
  resolveEnvironment,
  updateAccountSettings,
  updateSettings,
} from './settings';

describe('settings', () => {
  it('returns defaults and repairs invalid stored values', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.showFieldIdsOnPage).toBe(false);
    await fakeBrowser.storage.local.set({
      settings: { theme: 'neon', envColors: { sandbox: 'red' }, features: { quickGoto: false } },
    });
    const s = await getSettings();
    expect(s.theme).toBe('system');
    expect(s.envColors.sandbox).toBe('#d97706');
    expect(s.features.quickGoto).toBe(false);
    expect(s.features.fieldExplorer).toBe(true);
  });

  it('updates settings', async () => {
    await updateSettings({ theme: 'dark' });
    expect((await getSettings()).theme).toBe('dark');
  });

  it('stores per-account settings under acct:<id>:settings', async () => {
    await updateAccountSettings('1234567-sb1', { label: 'ACME – SB', color: '#123456' });
    expect(await getAccountSettings('1234567-sb1')).toEqual({
      label: 'ACME – SB',
      color: '#123456',
    });
    expect(await getAccountSettings('1234567')).toEqual({});
    await updateAccountSettings('1234567-sb1', { label: '', color: undefined });
    expect(await getAccountSettings('1234567-sb1')).toEqual({});
    expect(() => accountKey('bad:id', 'settings')).toThrow();
  });

  it('resolves environment and color with account overrides', () => {
    expect(resolveEnvironment('sandbox', DEFAULT_SETTINGS, {})).toEqual({
      environment: 'sandbox',
      color: '#d97706',
    });
    expect(
      resolveEnvironment('production', DEFAULT_SETTINGS, {
        environmentOverride: 'release_preview',
      }),
    ).toEqual({
      environment: 'release_preview',
      color: '#7c3aed',
    });
    expect(resolveEnvironment('production', DEFAULT_SETTINGS, { color: '#000000' }).color).toBe(
      '#000000',
    );
  });

  it('deletes all data', async () => {
    await updateSettings({ theme: 'dark' });
    await clearAllStorage();
    expect(await fakeBrowser.storage.local.get(null)).toEqual({});
  });
});

describe('goto history', () => {
  it('keeps the last 10 unique entries per account, newest first', async () => {
    for (let i = 0; i < 12; i++)
      await pushGotoHistory('1', { kind: 'mapped', recordType: 'salesorder', id: String(i) }, i);
    await pushGotoHistory('1', { kind: 'mapped', recordType: 'salesorder', id: '5' }, 99);
    const history = await getGotoHistory('1');
    expect(history).toHaveLength(10);
    expect(history[0]).toEqual({ kind: 'mapped', recordType: 'salesorder', id: '5', at: 99 });
    expect(history.filter((h) => h.id === '5')).toHaveLength(1);
    expect(await getGotoHistory('2')).toEqual([]);
  });
});
