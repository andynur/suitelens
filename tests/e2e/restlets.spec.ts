import { expect, SANDBOX, test, navigationNames, openTab, openSettings } from './harness';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`RESTlets: account-wide list, search, links, refresh and feature toggle (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}/app/common/entity/custjoblist.nl`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'RESTlets');
    await expect(panel.getByText('4 of 4 deployments')).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Deployment #601 ↗' })).toHaveAttribute(
      'href',
      `${SANDBOX}/app/common/scripting/scriptrecord.nl?id=601`,
    );
    await expect(panel.getByText('Not deployed')).toBeVisible();
    await expect(panel.getByText('Inactive script')).toBeVisible();
    const search = panel.getByRole('searchbox', { name: 'Search RESTlet names or IDs' });
    await search.fill('ORDERS_TEST');
    await expect(panel.getByText('1 of 4 deployments')).toBeVisible();
    await expect(panel.locator('mark')).toHaveText('orders_test');
    await search.fill('missing');
    await expect(panel.getByText('No deployments match your search.')).toBeVisible();
    await search.fill('');
    await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(panel.getByText('4 of 4 deployments')).toBeVisible();
    await openSettings(panel);
    const toggle = panel.getByRole('switch', { name: /^RESTlet Tester/ });
    await toggle.click();
    expect(await navigationNames(panel)).not.toContain('RESTlets');
    await toggle.click();
    await openTab(panel, 'RESTlets');
    await expect(panel.getByText('4 of 4 deployments')).toBeVisible();
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`RESTlet builder: GET, confirmed POST, collections and production guard (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}/app/common/entity/custjoblist.nl`);
    const panel = await openSidePanel();
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'RESTlets');
    await panel.getByRole('button', { name: 'Build request' }).first().click();
    await panel.getByRole('button', { name: 'Send request' }).click();
    await expect(panel.getByLabel('Response body')).toContainText('"method": "GET"');
    await panel.getByLabel('Method', { exact: true }).selectOption('POST');
    await panel.getByLabel('JSON body', { exact: true }).fill('{"memo":"demo"}');
    await panel.getByRole('button', { name: 'Send request' }).click();
    await expect(panel.getByRole('alertdialog')).toContainText('1234567-sb1 (Sandbox)');
    await panel.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(panel.getByLabel('Response body')).toContainText('"method": "POST"');
    await panel.getByLabel('Request name', { exact: true }).fill('Demo');
    await panel.getByRole('button', { name: 'Save request', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Load Demo', exact: true })).toBeVisible();
    await panel.reload();
    await openTab(panel, 'RESTlets');
    await panel.getByRole('button', { name: 'Build request' }).first().click();
    await panel.getByRole('button', { name: 'Load Demo', exact: true }).click();
    await expect(panel.getByLabel('Method', { exact: true })).toHaveValue('POST');
  });
}

test('RESTlet writes in production require account opt-in and target confirmation', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite('https://1234567.app.netsuite.com/app/common/entity/custjoblist.nl');
  const panel = await openSidePanel();
  await openTab(panel, 'RESTlets');
  await panel.getByRole('button', { name: 'Build request' }).first().click();
  await panel.getByLabel('Method', { exact: true }).selectOption('POST');
  await expect(panel.getByRole('button', { name: 'Send request' })).toBeDisabled();
  await openSettings(panel);
  await panel.getByLabel('Allow writes in production for this account').check();
  await openTab(panel, 'RESTlets');
  await panel.getByRole('button', { name: 'Build request' }).first().click();
  await panel.getByLabel('Method', { exact: true }).selectOption('POST');
  await panel.getByRole('button', { name: 'Send request' }).click();
  await expect(panel.getByRole('alertdialog')).toContainText('1234567 (Production)');
  await expect(panel.getByRole('alertdialog')).toContainText('production data');
  await panel.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(panel.getByLabel('Response body')).toContainText('"method": "POST"');
});
