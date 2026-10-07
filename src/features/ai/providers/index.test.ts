import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_AI_SETTINGS } from '../../../shared/storage/settings';

vi.mock('@anthropic-ai/sdk', () => ({ default: class {} }));

const { resolveAiProvider, usesFixtureProvider } = await import('./index');

describe('resolveAiProvider', () => {
  it('uses the fixture provider in fixture mode', async () => {
    expect(usesFixtureProvider({ adapterMode: 'fixture' })).toBe(true);
    const provider = await resolveAiProvider({ adapterMode: 'fixture', ai: DEFAULT_AI_SETTINGS });
    expect(provider.kind).toBe('fixture');
  });

  it('falls back to the build default adapter mode', () => {
    // vitest defines __SUITELENS_DEFAULT_ADAPTER__ as "fixture".
    expect(usesFixtureProvider({})).toBe(true);
  });

  it('uses the configured provider in live mode', async () => {
    expect(usesFixtureProvider({ adapterMode: 'live' })).toBe(false);
    const provider = await resolveAiProvider({ adapterMode: 'live', ai: DEFAULT_AI_SETTINGS });
    expect(provider.kind).toBe('anthropic');
    expect(provider.requiresKey).toBe(true);
  });

  it.each(['deepseek', 'gemini', 'commandcode'] as const)(
    'resolves %s in live mode',
    async (id) => {
      const provider = await resolveAiProvider({
        adapterMode: 'live',
        ai: { ...DEFAULT_AI_SETTINGS, provider: id },
      });
      expect(provider.kind).toBe(id);
      expect(provider.requiresKey).toBe(true);
    },
  );
});
