import type { browser } from 'wxt/browser';
import { test, expect, SANDBOX, SO_PATH, openTab, openSettings } from './harness';

test('first-open tour, replay, safe mode and local counters', async ({
  context,
  extensionId,
  openNetSuite,
}) => {
  await openNetSuite(SANDBOX + SO_PATH);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const dialog = panel.getByRole('dialog');
  await expect(dialog).toContainText('Step 1 of 3');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog).toContainText('Choose what you share');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog).toContainText('Step 3 of 3');
  await dialog.getByRole('button', { name: 'Start exploring' }).click();
  // Panel tips follow the welcome dialog once (ADR 0052).
  const tips = panel.getByRole('dialog', { name: 'Panel tips' });
  await expect(tips).toContainText('Step 1 of');
  await tips.getByRole('button', { name: 'Next' }).click();
  await tips.getByRole('button', { name: 'Close tips' }).click();
  await expect(dialog).toHaveCount(0);
  await panel.reload();
  await expect(panel.getByTestId('env-pill')).toBeVisible();
  await expect(panel.getByRole('tab', { name: 'Fields', exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await openSettings(panel);
  await panel.getByRole('button', { name: 'Replay onboarding' }).click();
  await expect(dialog).toContainText('Step 1 of 3');
  await dialog.getByRole('button', { name: 'Skip tour' }).click();
  await panel.getByRole('switch', { name: 'Collect feature opens on this device' }).click();
  await expect
    .poll(() =>
      panel.evaluate(async () => {
        const stored = await (
          globalThis as unknown as { chrome: typeof browser }
        ).chrome.storage.local.get('settings');
        return (stored.settings as { telemetryEnabled?: boolean } | undefined)?.telemetryEnabled;
      }),
    )
    .toBe(true);
  await openTab(panel, 'Fields');
  await openSettings(panel);
  await expect
    .poll(() =>
      panel.evaluate(
        async () =>
          (
            await (globalThis as unknown as { chrome: typeof browser }).chrome.storage.local.get(
              'telemetry:counts',
            )
          )['telemetry:counts'],
      ),
    )
    .toEqual({ record: 1, settings: 1 });
  await panel.getByRole('switch', { name: 'Safe mode' }).click();
  await expect(panel.getByRole('tab')).toHaveCount(1);
  await expect(panel.getByRole('tab', { name: 'Settings' })).toBeVisible();
  await panel.getByRole('switch', { name: 'Safe mode' }).click();
  await panel.getByRole('switch', { name: 'Collect feature opens on this device' }).click();
  await expect
    .poll(() =>
      panel.evaluate(
        async () =>
          (
            await (globalThis as unknown as { chrome: typeof browser }).chrome.storage.local.get(
              'telemetry:counts',
            )
          )['telemetry:counts'],
      ),
    )
    .toBeUndefined();
});
