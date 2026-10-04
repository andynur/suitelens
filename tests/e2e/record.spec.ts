import { expect, SANDBOX, SO_PATH, test } from './harness';

test('Record tab: Field Explorer shows body fields and the item sublist', async ({
  openNetSuite,
  openSidePanel,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();

  await expect(panel.getByTestId('env-pill')).toHaveText('Sandbox');
  await expect(panel.getByText('salesorder #1001')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'memo', exact: true })).toBeVisible();
  await expect(
    panel
      .getByRole('region', { name: 'Sublists' })
      .locator('summary')
      .getByText('item', { exact: true }),
  ).toBeVisible();

  await panel.getByRole('searchbox').fill('memo');
  const body = panel.getByRole('region', { name: 'Body fields' });
  await expect(body.locator('tbody tr')).toHaveCount(1);

  await body.getByRole('button', { name: 'memo', exact: true }).click();
  await expect(panel.getByRole('status').filter({ hasText: 'Copied memo' })).toBeVisible();
});

test('Record tab: "Show field IDs on page" adds badges to form labels', async ({
  openNetSuite,
  openSidePanel,
}) => {
  const page = await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  await expect(page.locator('[data-suitelens="field-id"]')).toHaveCount(0);

  await panel.getByRole('switch', { name: 'Show field IDs on page' }).click();
  await expect(page.locator('#memo_fs_lbl [data-suitelens="field-id"]')).toHaveText('memo');
  // NetSuite labels are uppercase; the badge must still show the ID as scripts use it.
  await expect(page.locator('#memo_fs_lbl [data-suitelens="field-id"]')).toHaveCSS(
    'text-transform',
    'none',
  );
  const labels = await page.locator('span[id$="_fs_lbl"]').count();
  const badges = await page.locator('[data-suitelens="field-id"]').count();
  expect(badges / labels).toBeGreaterThanOrEqual(0.9);

  await panel.getByRole('switch', { name: 'Show field IDs on page' }).click();
  await expect(page.locator('[data-suitelens="field-id"]')).toHaveCount(0);
});

test('Record tab: list pages show the "not a record" state', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite(`${SANDBOX}/app/accounting/transactions/transactionlist.nl`);
  const panel = await openSidePanel();
  await expect(panel.getByText('This page is not a record')).toBeVisible();
});
