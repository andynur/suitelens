import { expect, PRODUCTION, SANDBOX, SO_PATH, test } from './harness';

const banner = '#netsuite-suitelens-env-banner';

test('Settings tab: Environment Guard banner uses the configured color and label', async ({
  openNetSuite,
  openSidePanel,
}) => {
  const page = await openNetSuite(`${SANDBOX}${SO_PATH}`);
  await expect(page.locator(banner)).toHaveAttribute('data-environment', 'sandbox');
  const pill = page.locator(`${banner} .pill`);
  await expect(pill).toHaveText('1234567-SB1 · Sandbox');
  await expect(pill).toHaveCSS('background-color', 'rgb(217, 119, 6)');

  const panel = await openSidePanel();
  await panel.getByRole('tab', { name: 'Settings' }).click();
  const label = panel.getByRole('textbox', { name: 'Banner label' });
  await label.fill('ACME – SANDBOX');
  await label.press('Enter');
  await expect(pill).toHaveText('ACME – SANDBOX');

  await panel.getByRole('switch', { name: /Environment Guard/ }).click();
  await expect(page.locator(banner)).toHaveCount(0);
});

test('Settings tab: production gets the red banner; theme switches to dark', async ({
  openNetSuite,
  openSidePanel,
}) => {
  const page = await openNetSuite(`${PRODUCTION}${SO_PATH}`);
  await expect(page.locator(`${banner} .pill`)).toHaveCSS('background-color', 'rgb(220, 38, 38)');

  const panel = await openSidePanel();
  await panel.getByRole('tab', { name: 'Settings' }).click();
  await panel.getByRole('radio', { name: 'Dark' }).check();
  await expect(panel.locator('html')).toHaveClass(/dark/);
  await expect(
    panel.getByText('NetSuite is a trademark of Oracle Corporation', { exact: false }),
  ).toBeVisible();
});

test('Quick Go-to opens a record URL and remembers it per account', async ({
  openNetSuite,
  openSidePanel,
  context,
}) => {
  await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  await panel.getByRole('button', { name: 'Go to record' }).click();
  await panel.getByRole('combobox', { name: 'Record type' }).selectOption('customer');
  await panel.getByRole('textbox', { name: 'Internal ID' }).fill('2001');
  await panel.getByRole('checkbox', { name: 'Open in new tab' }).check();
  const newPage = context.waitForEvent('page');
  await panel.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(await newPage).toHaveURL(`${SANDBOX}/app/common/entity/custjob.nl?id=2001`);
  await expect(panel.getByRole('button', { name: 'customer #2001' })).toBeVisible();
});
