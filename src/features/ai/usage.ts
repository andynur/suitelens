import { browser } from 'wxt/browser';
import { z } from 'zod';
import { SuiteLensError } from '../../netsuite/errors';
import type { AiSettings } from '../../shared/storage/settings';
import type { AiUsage } from './types';

/**
 * Local per-day AI token counter (F-5.4, ADR 0041). Input + output tokens reported by the
 * provider, keyed by the local calendar day. Not per account: the key belongs to the user.
 */
export const AI_USAGE_KEY = 'ai:usage';

const StoredUsageSchema = z.object({
  day: z.string(),
  tokens: z.number().int().min(0),
});
export type AiUsageToday = z.infer<typeof StoredUsageSchema>;

/** Local date as `YYYY-MM-DD`. */
export function localDay(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getAiUsageToday(): Promise<{ day: string; tokens: number }> {
  const today = localDay();
  const stored = await browser.storage.local.get(AI_USAGE_KEY);
  const parsed = StoredUsageSchema.safeParse(stored[AI_USAGE_KEY]);
  if (!parsed.success || parsed.data.day !== today) return { day: today, tokens: 0 };
  return parsed.data;
}

export async function addAiUsage(usage: AiUsage): Promise<{ day: string; tokens: number }> {
  const current = await getAiUsageToday();
  const added = Math.max(0, usage.inputTokens) + Math.max(0, usage.outputTokens);
  const next = { day: current.day, tokens: current.tokens + added };
  await browser.storage.local.set({ [AI_USAGE_KEY]: next });
  return next;
}

/** Throws `AI_LIMIT_REACHED` when today's usage has reached the daily cap (0 = no cap). */
export async function assertWithinDailyLimit(
  ai: Pick<AiSettings, 'maxTokensPerDay'>,
): Promise<void> {
  if (ai.maxTokensPerDay <= 0) return;
  const { tokens } = await getAiUsageToday();
  if (tokens >= ai.maxTokensPerDay) {
    throw new SuiteLensError(
      'AI_LIMIT_REACHED',
      'The daily AI token limit is reached. Raise it in Settings or try again tomorrow.',
      `${tokens} of ${ai.maxTokensPerDay} tokens used today`,
    );
  }
}
