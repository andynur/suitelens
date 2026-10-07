import { describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { updateSettings } from '../../shared/storage/settings';
import { clearTelemetry, exportTelemetry, recordFeatureEvent, TELEMETRY_KEY } from './local';
describe('opt-in local telemetry', () => {
  it('writes nothing by default or for arbitrary strings', async () => {
    await recordFeatureEvent('record');
    await recordFeatureEvent('SELECT secret');
    expect((await browser.storage.local.get(TELEMETRY_KEY))[TELEMETRY_KEY]).toBeUndefined();
  });
  it('counts only allow-listed feature opens, serializes writes and deletes on request', async () => {
    await updateSettings({ telemetryEnabled: true });
    await Promise.all([
      recordFeatureEvent('record'),
      recordFeatureEvent('record'),
      recordFeatureEvent('console'),
    ]);
    expect(JSON.parse(await exportTelemetry())).toEqual({
      schemaVersion: 1,
      featureOpens: { record: 2, console: 1 },
    });
    await updateSettings({ safeMode: true });
    await recordFeatureEvent('record');
    expect(JSON.parse(await exportTelemetry()).featureOpens.record).toBe(2);
    await clearTelemetry();
    expect(JSON.parse(await exportTelemetry()).featureOpens).toEqual({});
  });
});
