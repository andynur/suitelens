import { expect, SANDBOX, test, openTab, navigationNames, openSettings } from './harness';
import { readFile } from 'node:fs/promises';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Logs: filters, grouped counts, JSON, CSV, full page and toggle (${colorScheme})`, async ({
    context,
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}/app/common/entity/custjoblist.nl`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'Logs');
    await expect(panel.getByText('6 of 6 logs')).toBeVisible();
    await panel.getByRole('button', { name: 'Filters' }).click();
    await expect(panel.getByLabel('Deployment name or ID')).toBeDisabled();
    await panel.getByRole('button', { name: 'About deployment information' }).click();
    await expect(panel.getByText(/Deployment information is unavailable/)).toBeVisible();
    await panel.keyboard.press('Escape');
    await expect(panel.getByText(/user-generated logs after about 30 days/)).toBeVisible();
    await panel.getByLabel('Log level', { exact: true }).selectOption('ERROR');
    await panel.getByRole('searchbox', { name: 'Search log titles and details' }).fill('not found');
    await expect(panel.getByText('3 occurrences')).toBeVisible();
    await panel.getByText('3 occurrences').click();
    await expect(panel.getByLabel('Log detail')).toHaveCount(3);
    const downloading = panel.waitForEvent('download');
    await panel.getByRole('button', { name: 'Export logs CSV' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('suitelens-1234567-sb1-logs.csv');
    expect(await readFile((await download.path())!, 'utf8')).toContain('Record 1001 not found');
    await panel.getByLabel('Log level', { exact: true }).selectOption('AUDIT');
    await panel.getByRole('searchbox', { name: 'Search log titles and details' }).fill('');
    await panel
      .getByRole('list', { name: 'Execution log groups' })
      .locator('summary')
      .first()
      .click();
    await expect(panel.getByLabel('Log detail')).toContainText('"status": "received"');
    await panel.getByLabel('Auto-refresh', { exact: true }).selectOption('30');
    const opening = context.waitForEvent('page');
    await panel.getByRole('button', { name: 'Open logs in full page' }).click();
    const full = await opening;
    await expect(full).toHaveURL(/logs.html\?targetTab=\d+/);
    await expect(full.getByRole('tab', { name: 'Logs', exact: true })).toHaveAttribute(
      'data-state',
      'active',
    );
    await expect(full.getByText('6 of 6 logs')).toBeVisible();
    await full.close();
    await openSettings(panel);
    await panel.getByRole('switch', { name: /^Log Viewer/ }).click();
    expect(await navigationNames(panel)).not.toContain('Logs');
  });
}
