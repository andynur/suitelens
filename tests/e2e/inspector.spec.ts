import { expect, SANDBOX, SO_PATH, test, navigationNames, openTab, openSettings } from './harness';

const records = [
  { path: SO_PATH, value: 'SO-FAKE-1001' },
  { path: '/app/common/entity/custjob.nl?id=2001&e=T', value: 'CUST-FAKE-2001' },
  { path: '/app/common/custom/custrecordentry.nl?rectype=123&id=5', value: 'Demo Config 5' },
];

for (const colorScheme of ['light', 'dark'] as const) {
  for (const record of records) {
    test(`Inspector: XML, JSON and search for ${record.value} (${colorScheme})`, async ({
      openNetSuite,
      openSidePanel,
    }) => {
      await openNetSuite(`${SANDBOX}${record.path}`);
      const panel = await openSidePanel();
      await panel.setViewportSize({ width: 390, height: 820 });
      await panel.emulateMedia({ colorScheme });
      expect(await navigationNames(panel)).toEqual(
        [
          'Fields',
          'Automation',
          'Raw data',
          'Related',
          'SuiteQL',
          'Logs',
          'Impact',
          'RESTlets',
          'Docs',
          'Settings',
        ].sort(),
      );
      await openTab(panel, 'Raw data');
      await expect(panel.getByRole('region', { name: 'JSON payload' })).toBeVisible();
      await expect(panel.getByRole('button', { name: 'JSON', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await panel.getByRole('button', { name: 'XML', exact: true }).click();
      const xml = panel.getByRole('region', { name: 'XML payload' });
      await expect(xml).toContainText(record.value);
      await expect(xml).not.toContainText('FAKE-CSRF');
      const root = xml.locator('summary').first();
      await root.click();
      await expect(xml).not.toContainText(record.value);
      await root.focus();
      await panel.keyboard.press('Enter');
      await expect(xml).toContainText(record.value);
      await panel
        .getByRole('searchbox', { name: 'Search payload names or values' })
        .fill(record.value);
      await expect(xml).toContainText(record.value);
      await expect(xml.locator('mark').first()).toHaveText(record.value);
      await panel.getByRole('button', { name: 'JSON', exact: true }).click();
      const json = panel.getByRole('region', { name: 'JSON payload' });
      await expect(json).toContainText(JSON.stringify(record.value));
      await expect(json.locator('mark').first()).toHaveText(record.value);
      await panel.getByRole('searchbox').fill('no-matching-entry');
      await expect(panel.getByText('No payload entries match your search.')).toBeVisible();
      await panel.getByRole('searchbox').fill('');
      await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
      await expect(json).toBeVisible();
    });
  }
}

test('Inspector: LiveAdapter transport reads fixture XML without an AMD module', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  await openSettings(panel);
  await panel.getByRole('combobox', { name: 'Data source' }).selectOption('live');
  await openTab(panel, 'Raw data');
  const json = panel.getByRole('region', { name: 'JSON payload' });
  await panel.getByRole('searchbox').fill('SO-FAKE-1001');
  await expect(json).toContainText('SO-FAKE-1001');
  await expect(json).not.toContainText('FAKE-CSRF');
});

test('Inspector: feature toggle removes the tab and re-enables it', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  await openTab(panel, 'Raw data');
  await expect(panel.getByRole('region', { name: 'JSON payload' })).toBeVisible();
  await openSettings(panel);
  const toggle = panel.getByRole('switch', { name: /^Record Inspector/ });
  await toggle.click();
  expect(await navigationNames(panel)).not.toContain('Raw data');
  await toggle.click();
  await openTab(panel, 'Raw data');
  await expect(panel.getByRole('region', { name: 'JSON payload' })).toBeVisible();
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Related: transaction branches, keyboard folding and refresh (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}${SO_PATH}`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'Related');
    await expect(panel.getByRole('region', { name: 'Transaction relationship tree' })).toHaveCount(
      0,
    );
    await panel.getByRole('button', { name: 'Load related transactions' }).click();
    const tree = panel.getByRole('region', { name: 'Transaction relationship tree' });
    await expect(tree).toBeVisible();
    for (const number of ['SO-FAKE-1001', 'IF-FAKE-1101', 'INV-FAKE-1201', 'PAY-FAKE-1301']) {
      await expect(tree.getByRole('link', { name: `${number} ↗` })).toBeVisible();
    }
    await expect(tree.getByRole('link', { name: 'IF-FAKE-1101 ↗' })).toHaveCount(1);
    await expect(tree.getByRole('link', { name: 'INV-FAKE-1201 ↗' })).toHaveAttribute(
      'href',
      `${SANDBOX}/app/accounting/transactions/transaction.nl?id=1201`,
    );
    const root = tree.locator('summary').first();
    await root.focus();
    await panel.keyboard.press('Enter');
    await expect(tree.getByRole('link', { name: 'IF-FAKE-1101 ↗' })).toBeHidden();
    await panel.keyboard.press('Enter');
    await expect(tree.getByRole('link', { name: 'IF-FAKE-1101 ↗' })).toBeVisible();
    await panel.getByRole('button', { name: 'Refresh related transactions' }).click();
    await expect(tree.getByRole('link', { name: 'PAY-FAKE-1301 ↗' })).toBeVisible();
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Inspector: masked complete payload exports (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}/app/common/entity/custjob.nl?id=2001&e=T`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'Raw data');
    await expect(panel.getByRole('region', { name: 'JSON payload' })).toBeVisible();
    const mask = panel.getByRole('switch', { name: /^Mask values/ });
    await mask.focus();
    await panel.keyboard.press('Space');
    await expect(mask).toBeChecked();
    await panel.getByRole('searchbox').fill('buyer@example.invalid');
    await expect(panel.getByText('No payload entries match your search.')).toBeVisible();
    // Capture the actual clipboard write without depending on host clipboard permissions.
    await panel.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            document.documentElement.dataset.copiedPayload = text;
          },
        },
      });
    });
    await panel.getByRole('button', { name: 'Copy payload' }).click();
    const copied = await panel.evaluate(() => document.documentElement.dataset.copiedPayload!);
    expect(JSON.parse(copied)).toHaveProperty('name', 'nsResponse');
    expect(copied).toContain('CUST-FAKE-2001');
    expect(copied).not.toContain('buyer@example.invalid');
    await panel.getByRole('button', { name: 'XML', exact: true }).click();
    const downloadEvent = panel.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download payload' }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('suitelens-1234567-sb1-customer-2001-masked.xml');
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const xml = Buffer.concat(chunks).toString('utf8');
    expect(xml).toContain('<email>[MASKED]</email>');
    expect(xml).toContain('CUST-FAKE-2001');
    expect(xml).not.toContain('buyer@example.invalid');
    await mask.click();
    await panel.getByRole('button', { name: 'Copy payload' }).click();
    await expect
      .poll(() => panel.evaluate(() => document.documentElement.dataset.copiedPayload))
      .toContain('buyer@example.invalid');
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Inspector: same-type comparison, keyboard submit and masking (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}${SO_PATH}`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'Raw data');
    await expect(panel.getByRole('region', { name: 'JSON payload' })).toBeVisible();
    // Compare is an action on Raw data (ADR 0052).
    await panel.getByRole('button', { name: 'Compare with…' }).click();
    const compare = panel.getByRole('region', { name: 'Mini Record Compare' });
    const input = compare.getByRole('textbox', { name: 'Other record internal ID' });
    await input.fill('1001');
    await expect(compare.getByRole('button', { name: 'Compare records' })).toBeDisabled();
    await input.fill('1002');
    await input.press('Enter');
    const table = compare.getByRole('table', { name: 'Record comparison' });
    await expect(table).toContainText('Fake comparison order');
    await expect(table).toContainText('Changed');
    await expect(table).toContainText('other@example.invalid');
    await panel.getByRole('switch', { name: /^Mask values/ }).click();
    await expect(table).not.toContainText('other@example.invalid');
    await expect(table).toContainText('[MASKED]');
    await compare.getByRole('button', { name: 'Show unchanged fields' }).click();
    await expect(table).toContainText('Unchanged');
    await compare.getByRole('button', { name: 'Clear comparison' }).click();
    await expect(table).toHaveCount(0);
    await openSettings(panel);
    await panel.getByRole('combobox', { name: 'Data source' }).selectOption('live');
    await openTab(panel, 'Raw data');
    await expect(panel.getByRole('region', { name: 'JSON payload' })).toBeVisible();
    await panel.getByRole('button', { name: 'Compare with…' }).click();
    await input.fill('1002');
    await input.press('Enter');
    await expect(table).toContainText('Fake comparison order');
    await expect(table).not.toContainText('FAKE-CSRF');
  });
}
