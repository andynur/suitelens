import { expect, SANDBOX, SO_PATH, test, openTab } from './harness';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Record tab: retains its snapshot across tabs and refreshes manually (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}${SO_PATH}`);
    const panel = await openSidePanel();
    await panel.emulateMedia({ colorScheme });
    const memo = panel.getByRole('button', { name: 'memo', exact: true });
    await expect(memo).toBeVisible();
    await panel.getByRole('searchbox').fill('memo');
    await expect(memo.locator('mark')).toHaveText('memo');
    // Tag the loaded row: a remount/reload would discard this DOM node.
    await memo.evaluate((element) => element.setAttribute('data-retained-snapshot', 'true'));

    for (const tab of ['Automation', 'Settings']) {
      await openTab(panel, tab);
      await expect(memo).toBeHidden();
      await openTab(panel, 'Fields');
      await expect(memo).toBeVisible();
      await expect(memo).toHaveAttribute('data-retained-snapshot', 'true');
      await expect(panel.getByRole('searchbox')).toHaveValue('memo');
    }

    await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(memo).toBeVisible();
    await expect(memo).not.toHaveAttribute('data-retained-snapshot', 'true');
    await expect(panel.getByRole('searchbox')).toHaveValue('memo');
  });
}

test('Record tab: Field Explorer shows body fields and the item sublist', async ({
  openNetSuite,
  openSidePanel,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();

  await expect(panel.getByTestId('env-pill')).toHaveText('Sandbox');
  await expect(panel.getByText(/^Sales Order/)).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Copy internal ID 1001' })).toHaveText('#1001');
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

test('Record tab: "Show on page" scrolls to the field and outlines it', async ({
  openNetSuite,
  openSidePanel,
}) => {
  const page = await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  const row = panel.locator('tr[data-field-id="memo"]');
  await row.hover();
  await row.getByRole('button', { name: /^Show .* on the page$/ }).click();
  await expect(page.locator('[data-suitelens-highlight]')).toContainText('Memo');
  await expect(page.locator('[data-suitelens-highlight]')).toHaveCount(0, { timeout: 5000 });
});

test('Record tab: list pages open Home and explain the "not a record" state', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite(`${SANDBOX}/app/accounting/transactions/transactionlist.nl`);
  const panel = await openSidePanel();
  await expect(panel.getByRole('heading', { name: 'Welcome to SuiteLens' })).toBeVisible();
  await openTab(panel, 'Fields');
  await expect(panel.getByText('This page is not a record')).toBeVisible();
});
