import { expect, SANDBOX, SO_PATH, test, openTab } from './harness';

test('Automation tab: shows scripts and workflows in execution-group order', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  await openTab(panel, 'Automation');

  await expect(panel.getByText('Automations for salesorder')).toBeVisible();
  const groups = panel.getByRole('region');
  await expect(groups).toHaveText([
    /Client scripts/,
    /User Event scripts/,
    /Workflow Action scripts/,
    /Workflows/,
  ]);
  // Cards are collapsed to name + script ID; details open on click.
  await expect(panel.getByText('customdeploy_suitelens_so_ue')).toBeHidden();
  for (const summary of await panel.locator('li[data-automation-id] summary').all()) {
    await summary.click();
  }
  await expect(panel.getByText('customdeploy_suitelens_so_ue')).toBeVisible();
  await expect(panel.getByText('customdeploy_suitelens_so_cs')).toBeVisible();
  await panel.getByRole('button', { name: 'About execution order' }).click();
  await expect(panel.getByText(/Order is approximate/)).toBeVisible();
  await panel.keyboard.press('Escape');

  await panel.getByRole('searchbox').fill('CUSTOMDEPLOY_SUITELENS_SO_UE');
  await expect(panel.locator('mark')).toHaveText('customdeploy_suitelens_so_ue');
  await expect(panel.locator('mark')).toBeVisible();
  await panel.getByRole('searchbox').fill('');
  await expect(panel.locator('mark')).toHaveCount(0);

  // Second load comes from the per-account cache; refresh bypasses it.
  await openTab(panel, 'Fields');
  await openTab(panel, 'Automation');
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
  await openTab(panel, 'Automation');
  await panel.locator('li[data-automation-id] summary').first().click();
  await expect(panel.getByText('customdeploy_suitelens_demo_cs')).toBeVisible();
});
