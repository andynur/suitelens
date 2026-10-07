import { browser } from 'wxt/browser';
import { z } from 'zod';
import { getSettings } from '../../shared/storage/settings';

/** Opt-in local counters only. No identifiers, payloads, timestamps or network transport. */
export const TELEMETRY_KEY = 'telemetry:counts';
export const TelemetryEventSchema = z.enum([
  'record',
  'automation',
  'console',
  'inspector',
  'restlets',
  'impact',
  'logs',
  'ai',
  'settings',
]);
const CountsSchema = z
  .partialRecord(TelemetryEventSchema, z.number().int().min(0).max(1_000_000))
  .catch({} as Record<z.infer<typeof TelemetryEventSchema>, number>);
let queue: Promise<void> = Promise.resolve();
export function recordFeatureEvent(input: unknown): Promise<void> {
  const event = TelemetryEventSchema.safeParse(input);
  if (!event.success) return Promise.resolve();
  queue = queue
    .catch(() => {})
    .then(async () => {
      const settings = await getSettings();
      if (!settings.telemetryEnabled || settings.safeMode) return;
      const stored = await browser.storage.local.get(TELEMETRY_KEY);
      const counts = CountsSchema.parse(stored[TELEMETRY_KEY] ?? {});
      counts[event.data] = Math.min(1_000_000, (counts[event.data] ?? 0) + 1);
      await browser.storage.local.set({ [TELEMETRY_KEY]: counts });
    });
  return queue;
}
export async function clearTelemetry(): Promise<void> {
  await queue.catch(() => {});
  await browser.storage.local.remove(TELEMETRY_KEY);
}
export async function exportTelemetry(): Promise<string> {
  await queue.catch(() => {});
  const stored = await browser.storage.local.get(TELEMETRY_KEY);
  return JSON.stringify(
    { schemaVersion: 1, featureOpens: CountsSchema.parse(stored[TELEMETRY_KEY] ?? {}) },
    null,
    2,
  );
}
