import { describe, expect, it, vi } from 'vitest';
import { createFixtureProvider, fixtureAnswer } from './fixture';
import type { AiStreamParams } from './types';

function params(overrides: Partial<AiStreamParams> = {}): AiStreamParams {
  return {
    feature: 'suiteql',
    model: 'claude-test',
    maxTokens: 4096,
    system: 'abcd',
    messages: [{ role: 'user', content: 'efgh' }],
    signal: new AbortController().signal,
    onDelta: vi.fn(),
    ...overrides,
  };
}

describe('fixture provider', () => {
  it('needs no key and streams the canned answer in chunks', async () => {
    const provider = createFixtureProvider({ chunkSize: 3, delayMs: 0 });
    expect(provider.requiresKey).toBe(false);
    const onDelta = vi.fn();
    const result = await provider.stream(params({ onDelta }));
    const answer = fixtureAnswer('suiteql');

    expect(result.text).toBe(answer);
    expect(onDelta.mock.calls.map(([chunk]) => chunk as string).join('')).toBe(answer);
    expect(onDelta.mock.calls.length).toBe(Math.ceil(answer.length / 3));
    expect(result.usage).toEqual({ inputTokens: 2, outputTokens: Math.ceil(answer.length / 4) });
    expect(result.stopReason).toBe('end_turn');
  });

  it('falls back to a generic answer for empty fixtures', () => {
    for (const feature of ['suiteql', 'explainScript', 'explainError'] as const) {
      expect(fixtureAnswer(feature).length).toBeGreaterThan(0);
    }
  });

  it('honours abort', async () => {
    const provider = createFixtureProvider({ chunkSize: 1, delayMs: 1 });
    const controller = new AbortController();
    const onDelta = vi.fn(() => controller.abort());
    await expect(
      provider.stream(params({ signal: controller.signal, onDelta })),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(onDelta).toHaveBeenCalledTimes(1);
  });
});
