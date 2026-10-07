import { expect, SANDBOX, SO_PATH, test, openSettings } from './harness';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Commands: keyboard feature navigation, snippets and account links (${colorScheme})`, async ({
    context,
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}${SO_PATH}`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    const input = panel.getByRole('combobox', { name: 'Search commands' });
    await panel.keyboard.press('Control+k');
    await expect(input).toBeFocused();
    await input.fill('restlet');
    await panel.keyboard.press('Enter');
    await expect(panel.getByRole('tab', { name: 'RESTlets', exact: true })).toHaveAttribute(
      'data-state',
      'active',
    );
    await expect(panel.getByRole('region', { name: 'Commands', exact: true })).toHaveCount(0);
    await panel.keyboard.press('Meta+k');
    await input.fill('open fields');
    await panel.keyboard.press('Enter');
    await expect(panel.getByRole('tab', { name: 'Fields', exact: true })).toHaveAttribute(
      'data-state',
      'active',
    );
    await panel.keyboard.press('Control+k');
    await input.fill('suiteql');
    await panel.keyboard.press('Enter');
    await expect(panel.getByRole('button', { name: /^Run (query|selection)$/ })).toBeVisible();
    await panel.keyboard.press('Control+k');
    await input.fill('snippet:');
    const first = panel.getByRole('option').first();
    const optionName = await first.textContent();
    await panel.keyboard.press('ArrowDown');
    await panel.keyboard.press('ArrowUp');
    await panel.keyboard.press('Enter');
    expect(optionName).toContain('Open snippet:');
    await expect(panel.getByRole('button', { name: 'Query 2' })).toBeVisible();
    await expect(panel.locator('.cm-content')).not.toHaveText('');
    await expect(panel.getByRole('table', { name: 'Query results' })).toHaveCount(0);
    await panel.keyboard.press('Control+k');
    await input.fill('script 501');
    const opening = context.waitForEvent('page');
    await panel.keyboard.press('Enter');
    const scriptPage = await opening;
    // Fixture routing deliberately returns 404 for metadata pages; navigation URL is the contract.
    await expect(scriptPage).toHaveURL(`${SANDBOX}/app/common/scripting/script.nl?id=501`);
    await scriptPage.close();
    await panel.keyboard.press('Control+k');
    await input.fill('record customer 2001');
    const openingRecord = context.waitForEvent('page');
    await panel.keyboard.press('Enter');
    const record = await openingRecord;
    await expect(record).toHaveURL(`${SANDBOX}/app/common/entity/custjob.nl?id=2001`);
    await record.close();
    await openSettings(panel);
    await panel.getByRole('switch', { name: /^RESTlet Tester/ }).click();
    await panel.keyboard.press('Control+k');
    await input.fill('restlet');
    await expect(panel.getByRole('option', { name: 'Open RESTlet Tester' })).toHaveCount(0);
    await panel.keyboard.press('Escape');
    await expect(input).toHaveCount(0);
    await panel.getByRole('switch', { name: /^Command Palette/ }).click();
    await panel.keyboard.press('Control+k');
    await expect(panel.getByRole('form', { name: 'Quick Go-to' })).toBeVisible();
  });
}
