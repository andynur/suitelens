import { describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  aiSecretKey,
  aiSessionKey,
  deleteAiKey,
  getAiKeyInfo,
  getUnlockedAiKey,
  lockAiKey,
  saveAiKey,
  unlockAiKey,
} from './aiSecret';

const KEY = 'sk-ant-test-0123456789abcdef';
const PASS = 'correct horse battery';

async function raw() {
  return {
    local: await fakeBrowser.storage.local.get(null),
    session: await fakeBrowser.storage.session.get(null),
  };
}

describe('aiSecret', () => {
  it('reports no key by default', async () => {
    expect(await getAiKeyInfo('anthropic')).toEqual({ stored: 'none', unlocked: false });
    expect(await getUnlockedAiKey('anthropic')).toBeUndefined();
  });

  it('encrypts a remembered key and never stores it in plain text', async () => {
    await saveAiKey('anthropic', `  ${KEY} `, { mode: 'encrypted', passphrase: PASS });
    const { local } = await raw();
    expect(JSON.stringify(local)).not.toContain(KEY);
    expect(JSON.stringify(local)).not.toContain(PASS);
    expect(local[aiSecretKey('anthropic')]).toMatchObject({ v: 1 });
    expect(await getAiKeyInfo('anthropic')).toEqual({ stored: 'encrypted', unlocked: true });
    expect(await getUnlockedAiKey('anthropic')).toBe(KEY);
  });

  it('locks and unlocks with the passphrase', async () => {
    await saveAiKey('anthropic', KEY, { mode: 'encrypted', passphrase: PASS });
    await lockAiKey('anthropic');
    expect(await getAiKeyInfo('anthropic')).toEqual({ stored: 'encrypted', unlocked: false });
    expect(await getUnlockedAiKey('anthropic')).toBeUndefined();
    expect((await raw()).local[aiSecretKey('anthropic')]).toBeDefined();

    await expect(unlockAiKey('anthropic', 'wrong passphrase')).rejects.toThrow('Wrong passphrase.');
    expect(await getUnlockedAiKey('anthropic')).toBeUndefined();

    await unlockAiKey('anthropic', PASS);
    expect(await getUnlockedAiKey('anthropic')).toBe(KEY);
  });

  it('keeps a session-only key out of persistent storage', async () => {
    await saveAiKey('anthropic', KEY, { mode: 'encrypted', passphrase: PASS });
    await saveAiKey('anthropic', KEY, { mode: 'session' });
    const { local, session } = await raw();
    expect(local[aiSecretKey('anthropic')]).toBeUndefined();
    expect(JSON.stringify(local)).not.toContain(KEY);
    expect(session[aiSessionKey('anthropic')]).toBeDefined();
    expect(await getAiKeyInfo('anthropic')).toEqual({ stored: 'session', unlocked: true });
  });

  it('deleting the key removes it from local and session storage', async () => {
    await saveAiKey('anthropic', KEY, { mode: 'encrypted', passphrase: PASS });
    await deleteAiKey('anthropic');
    const { local, session } = await raw();
    expect(local[aiSecretKey('anthropic')]).toBeUndefined();
    expect(session[aiSessionKey('anthropic')]).toBeUndefined();
    expect(JSON.stringify({ local, session })).not.toContain(KEY);
    expect(await getAiKeyInfo('anthropic')).toEqual({ stored: 'none', unlocked: false });

    await saveAiKey('anthropic', KEY, { mode: 'session' });
    await deleteAiKey('anthropic');
    expect(JSON.stringify(await raw())).not.toContain(KEY);
  });

  it('"Delete all data" (clearing both storage areas) removes the key', async () => {
    await saveAiKey('anthropic', KEY, { mode: 'encrypted', passphrase: PASS });
    await fakeBrowser.storage.local.clear();
    await fakeBrowser.storage.session.clear();
    expect(await getAiKeyInfo('anthropic')).toEqual({ stored: 'none', unlocked: false });
  });

  it('validates the key and passphrase', async () => {
    await expect(saveAiKey('anthropic', '   ', { mode: 'session' })).rejects.toThrow();
    await expect(saveAiKey('anthropic', 'sk ant key', { mode: 'session' })).rejects.toThrow();
    await expect(
      saveAiKey('anthropic', KEY, { mode: 'encrypted', passphrase: 'short' }),
    ).rejects.toThrow();
    await expect(unlockAiKey('anthropic', PASS)).rejects.toThrow('No saved AI key');
    expect(await getAiKeyInfo('anthropic')).toEqual({ stored: 'none', unlocked: false });
  });

  it('ignores a corrupted blob', async () => {
    await fakeBrowser.storage.local.set({ [aiSecretKey('anthropic')]: { v: 9 } });
    expect(await getAiKeyInfo('anthropic')).toEqual({ stored: 'none', unlocked: false });
  });

  it('keeps one key per provider', async () => {
    await saveAiKey('anthropic', KEY, { mode: 'encrypted', passphrase: PASS });
    await saveAiKey('deepseek', 'sk-deepseek-0123456789', { mode: 'session' });
    expect(await getUnlockedAiKey('anthropic')).toBe(KEY);
    expect(await getUnlockedAiKey('deepseek')).toBe('sk-deepseek-0123456789');
    expect(await getAiKeyInfo('openai')).toEqual({ stored: 'none', unlocked: false });

    await deleteAiKey('deepseek');
    expect(await getAiKeyInfo('deepseek')).toEqual({ stored: 'none', unlocked: false });
    expect(await getUnlockedAiKey('anthropic')).toBe(KEY);
    expect(Object.keys((await raw()).local)).toEqual([aiSecretKey('anthropic')]);
  });
});
