import { expect, SANDBOX, SO_PATH, test, openTab, openSettings } from './harness';

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
  await openSettings(panel);
  await panel.getByRole('combobox', { name: 'Data source' }).selectOption('live');
  await expect(panel.getByText('Fixture data')).toHaveCount(0);

  await openTab(panel, 'Fields');
  await expect(
    panel.getByRole('img', { name: /^Source: record XML \+ page labels/ }),
  ).toBeVisible();
  const body = panel.getByRole('region', { name: 'Body fields' });
  const entity = body.locator('tr[data-field-id="entity"]');
  await expect(entity).toContainText('Customer');
  await expect(entity).toContainText('Mandatory');
  await expect(entity).toContainText('2001');

  await openTab(panel, 'Automation');
  await expect(panel.getByRole('alert')).toContainText("NetSuite's module loader is not available");
});

test('Live console: invalid NetSuite result shows the failing stage without result values', async ({
  openNetSuite,
  openSidePanel,
}) => {
  const page = await openNetSuite(`${SANDBOX}${SO_PATH}`);
  await page.evaluate(() => {
    Object.assign(window, {
      require: (deps: string[], callback: (module: unknown) => void) => {
        callback(
          deps[0] === 'N/query'
            ? {
                runSuiteQL: Object.assign(() => {}, {
                  promise: async () => ({
                    asMappedResults: () => [{ memo: { privateValue: 'DO-NOT-DISPLAY' } }],
                  }),
                }),
              }
            : undefined,
        );
      },
    });
  });
  const panel = await openSidePanel();
  await openSettings(panel);
  await panel.getByRole('combobox', { name: 'Data source' }).selectOption('live');
  await openTab(panel, 'SuiteQL');
  await panel.getByRole('textbox', { name: 'SuiteQL editor' }).fill('SELECT memo FROM transaction');
  await panel.getByRole('button', { name: 'Run query', exact: true }).click();
  await panel.getByText('Details', { exact: true }).click();
  const alert = panel.getByRole('alert');
  await expect(alert).toContainText('NetSuite returned unsupported SuiteQL result values.');
  await expect(alert).toContainText('0.memo: invalid_union');
  await expect(alert).not.toContainText('DO-NOT-DISPLAY');
});
