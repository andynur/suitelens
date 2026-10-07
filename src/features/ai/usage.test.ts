import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  AI_USAGE_KEY,
  addAiUsage,
  assertWithinDailyLimit,
  getAiUsageToday,
  localDay,
} from './usage';

afterEach(() => {
  vi.useRealTimers();
});

describe('AI usage counter', () => {
  it('formats the local day', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('starts at zero and adds input + output tokens', async () => {
    expect(await getAiUsageToday()).toEqual({ day: localDay(), tokens: 0 });
    await addAiUsage({ inputTokens: 100, outputTokens: 20 });
    await addAiUsage({ inputTokens: 5, outputTokens: 5 });
    expect(await getAiUsageToday()).toEqual({ day: localDay(), tokens: 130 });
  });

  it('resets on a new day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 6, 22, 0));
    await addAiUsage({ inputTokens: 50, outputTokens: 0 });
    vi.setSystemTime(new Date(2026, 9, 7, 8, 0));
    expect(await getAiUsageToday()).toEqual({ day: '2026-10-07', tokens: 0 });
    await addAiUsage({ inputTokens: 1, outputTokens: 1 });
    expect(await getAiUsageToday()).toEqual({ day: '2026-10-07', tokens: 2 });
  });

  it('ignores malformed stored values', async () => {
    await fakeBrowser.storage.local.set({ [AI_USAGE_KEY]: { day: localDay(), tokens: -4 } });
    expect((await getAiUsageToday()).tokens).toBe(0);
  });

  it('enforces the daily limit', async () => {
    await expect(assertWithinDailyLimit({ maxTokensPerDay: 0 })).resolves.toBeUndefined();
    await addAiUsage({ inputTokens: 900, outputTokens: 99 });
    await expect(assertWithinDailyLimit({ maxTokensPerDay: 1000 })).resolves.toBeUndefined();
    await addAiUsage({ inputTokens: 0, outputTokens: 1 });
    await expect(assertWithinDailyLimit({ maxTokensPerDay: 1000 })).rejects.toMatchObject({
      code: 'AI_LIMIT_REACHED',
    });
    await expect(assertWithinDailyLimit({ maxTokensPerDay: 0 })).resolves.toBeUndefined();
  });
});
