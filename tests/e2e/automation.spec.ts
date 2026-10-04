import { expect, SANDBOX, SO_PATH, test } from './harness';

test('Automation tab: shows scripts and workflows in execution-group order', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  await panel.getByRole('tab', { name: 'Automation' }).click();

  await expect(panel.getByText('Automations for salesorder')).toBeVisible();
  const groups = panel.getByRole('region');
  await expect(groups).toHaveText([
    /Client scripts/,
    /User Event scripts/,
    /Workflow Action scripts/,
    /Workflows/,
  ]);
  await expect(panel.getByText('customdeploy_suitelens_so_ue')).toBeVisible();
  await expect(panel.getByText('customdeploy_suitelens_so_cs')).toBeVisible();
  await expect(panel.getByText(/Order is approximate/)).toBeVisible();

  // Second load comes from the per-account cache; refresh bypasses it.
  await panel.getByRole('tab', { name: 'Record' }).click();
  await panel.getByRole('tab', { name: 'Automation' }).click();
  await expect(panel.getByText(/^Cached /)).toBeVisible();
  await panel.getByRole('button', { name: 'Refresh' }).click();
  await expect(panel.getByText(/^Loaded /)).toBeVisible();
});

test('Automation tab: custom record types are resolved and mapped', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite(`${SANDBOX}/app/common/custom/custrecordentry.nl?rectype=123&id=5`);
  const panel = await openSidePanel();
  await panel.getByRole('tab', { name: 'Automation' }).click();
  await expect(panel.getByText('customdeploy_suitelens_demo_cs')).toBeVisible();
});
