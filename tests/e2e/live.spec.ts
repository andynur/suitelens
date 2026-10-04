import { expect, SANDBOX, SO_PATH, test } from './harness';

/**
 * LiveAdapter path end to end: side panel → background → content script → record XML
 * (same-origin, served from fixtures) and → MAIN-world bridge. The fixture pages have no
 * NetSuite `require`, so bridge operations must fail with a friendly message.
 */
test('Live mode: record XML + page labels, and a friendly error when N/* is unavailable', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  await panel.getByRole('tab', { name: 'Settings' }).click();
  await panel.getByRole('combobox', { name: 'Data source' }).selectOption('live');
  await expect(panel.getByText('Fixture data')).toHaveCount(0);

  await panel.getByRole('tab', { name: 'Record' }).click();
  await expect(panel.getByText('Source: record XML + page labels')).toBeVisible();
  const body = panel.getByRole('region', { name: 'Body fields' });
  const entity = body.locator('tr[data-field-id="entity"]');
  await expect(entity).toContainText('Customer');
  await expect(entity).toContainText('Mandatory');
  await expect(entity).toContainText('2001');

  await panel.getByRole('tab', { name: 'Automation' }).click();
  await expect(panel.getByRole('alert')).toContainText("NetSuite's module loader is not available");
});
