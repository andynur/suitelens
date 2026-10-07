import {
  expect,
  PRODUCTION,
  SANDBOX,
  SO_PATH,
  test,
  openTab,
  navigationNames,
  openSettings,
} from './harness';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Console: SQL formatting, tabs, reload and account isolation (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    const page = await openNetSuite(`${SANDBOX}${SO_PATH}`);
    const panel = await openSidePanel();
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'SuiteQL');
    const editor = panel.getByRole('textbox', { name: 'SuiteQL editor' });
    const name = panel.getByRole('textbox', { name: 'Query name' });
    await editor.fill('select id, tranid from transaction where ROWNUM <= 10');
    await panel.getByRole('button', { name: 'Query options' }).click();
    await name.fill('Latest transactions');
    await panel.getByRole('button', { name: 'Format SQL' }).click();
    await expect(editor).toContainText('SELECT');
    await expect(editor).toContainText('FROM');
    await expect(editor.locator('span').filter({ hasText: /^SELECT$/ })).toHaveCSS(
      'color',
      colorScheme === 'dark' ? 'rgb(102, 157, 241)' : 'rgb(24, 104, 219)',
    );
    await panel.getByRole('button', { name: 'New query' }).click();
    await editor.fill("select '第二 query' from transaction");
    await expect(
      panel.getByRole('status').filter({ hasText: 'Drafts saved locally' }),
    ).toBeVisible();
    await panel.reload();
    await openTab(panel, 'SuiteQL');
    await expect(editor).toContainText('第二 query');
    await panel.getByRole('button', { name: 'Latest transactions', exact: true }).click();
    await expect(editor).toContainText('tranid');
    await openTab(panel, 'Fields');
    await openTab(panel, 'SuiteQL');
    await expect(editor).toContainText('tranid');

    // Console also works on non-record pages; a new account starts with a clean workspace.
    await page.goto(`${PRODUCTION}/app/accounting/transactions/transactionlist.nl`);
    await expect(panel.getByTestId('env-pill')).toHaveText('Production');
    await panel.getByRole('button', { name: 'Query options' }).click();
    await expect(name).toHaveValue('Query 1');
    await expect(editor).toHaveText('');
    await editor.fill('select 42');
    await expect(
      panel.getByRole('status').filter({ hasText: 'Drafts saved locally' }),
    ).toBeVisible();
    await page.goto(`${SANDBOX}${SO_PATH}`);
    await expect(panel.getByTestId('env-pill')).toHaveText('Sandbox');
    await panel.getByRole('button', { name: 'Query options' }).click();
    await expect(name).toHaveValue('Latest transactions');
    await expect(editor).toContainText('tranid');
    await panel.getByRole('button', { name: 'Close query' }).click();
    await expect(editor).toContainText('第二 query');
    await expect(panel.getByRole('button', { name: 'Close query' })).toBeDisabled();
  });
}

test('Console: invalid SQL stays unchanged, feature toggle and Delete all data include drafts', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  await openTab(panel, 'SuiteQL');
  const editor = panel.getByRole('textbox', { name: 'SuiteQL editor' });
  await editor.fill("select 'unterminated");
  await panel.getByRole('button', { name: 'Format SQL' }).click();
  await expect(panel.getByRole('alert')).toContainText('could not be formatted');
  await expect(editor).toHaveText("select 'unterminated");
  await openSettings(panel);
  await panel.getByRole('switch', { name: /^SuiteQL Console/ }).click();
  expect(await navigationNames(panel)).not.toContain('SuiteQL');
  await panel.getByRole('switch', { name: /^SuiteQL Console/ }).click();
  await panel.getByRole('button', { name: 'Delete all SuiteLens data' }).click();
  await panel.getByRole('button', { name: 'Confirm', exact: true }).click();
  // Delete all data resets the first-open preference as well as drafts and libraries.
  await expect(panel.getByRole('dialog')).toContainText('Step 1 of 3');
  await panel.getByRole('button', { name: 'Skip tour' }).click();
  await panel.getByRole('button', { name: 'Close tips' }).click();
  await expect(
    panel.getByRole('status').filter({ hasText: 'All SuiteLens data deleted' }),
  ).toBeVisible();
  await openTab(panel, 'SuiteQL');
  await expect(editor).toHaveText('');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Console: run query, keyboard, selection, cancellation and errors (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}${SO_PATH}`);
    const panel = await openSidePanel();
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'SuiteQL');
    const editor = panel.getByRole('textbox', { name: 'SuiteQL editor' });
    const run = panel.getByRole('button', { name: 'Run query', exact: true });
    // Split run button: its label follows the selection.
    const selection = panel.getByRole('button', { name: 'Run selection', exact: true });
    const cancel = panel.getByRole('button', { name: 'Cancel', exact: true });
    const resultStatus = panel.getByRole('status').filter({ hasText: /10 rows/ });
    await expect(run).toBeDisabled();
    await expect(selection).toHaveCount(0);
    // Cancel appears only while a query runs.
    await expect(cancel).toHaveCount(0);
    await editor.fill('SELECT id, tranid FROM transaction WHERE ROWNUM <= 10');
    await run.click();
    await expect(resultStatus).toBeVisible();
    await expect(panel.getByRole('table', { name: 'Query results' })).toContainText('SO-DEMO-010');
    const table = panel.getByRole('table', { name: 'Query results' });
    await table.getByRole('button', { name: 'id', exact: true }).click();
    await expect(table.getByRole('columnheader', { name: /^id/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await table.getByRole('button', { name: 'id', exact: true }).click();
    await expect(table.getByRole('row').nth(1)).toContainText('SO-DEMO-010');
    const resize = table.getByRole('separator', { name: 'Resize tranid column' });
    await resize.focus();
    const initial = Number(await resize.getAttribute('aria-valuenow'));
    await resize.press('ArrowRight');
    await expect(resize).toHaveAttribute('aria-valuenow', String(initial + 16));
    const bounds = (await resize.boundingBox())!;
    await panel.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await panel.mouse.down();
    await panel.mouse.move(bounds.x + bounds.width / 2 + 48, bounds.y + bounds.height / 2);
    await panel.mouse.up();
    await expect(resize).toHaveAttribute('aria-valuenow', String(initial + 64));
    await panel.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            document.documentElement.dataset.copiedText = text;
          },
        },
      });
    });
    await table.getByRole('row').nth(1).hover();
    await table.getByRole('button', { name: 'Copy tranid, row 1', exact: true }).click();
    await expect(panel.locator('html')).toHaveAttribute('data-copied-text', 'SO-DEMO-010');
    await table.getByRole('button', { name: 'Copy row 1 as JSON' }).click();
    await expect(panel.locator('html')).toHaveAttribute(
      'data-copied-text',
      /"tranid":"SO-DEMO-010"/,
    );
    await editor.press('ControlOrMeta+Enter');
    await expect(resultStatus).toBeVisible();

    await editor.fill('SELECT id FROM transaction WHERE ROWNUM <= 10;\nDELETE FROM transaction');
    await run.click();
    await expect(panel.getByRole('alert')).toBeVisible();
    await editor.press('ControlOrMeta+Home');
    await editor.press('Shift+ArrowDown');
    await expect(selection).toBeEnabled();
    await selection.click();
    await expect(resultStatus).toBeVisible();
    await expect(panel.getByRole('table', { name: 'Query results' })).not.toContainText('tranid');
    await editor.press('ControlOrMeta+Enter');
    await expect(resultStatus).toBeVisible();

    await editor.fill('SELECT id, tranid FROM transaction WHERE ROWNUM <= 10');
    await run.click();
    await cancel.click();
    await expect(panel.getByRole('status').filter({ hasText: 'Query cancelled' })).toBeVisible();
    await expect(run).toBeEnabled();
    // Rerun immediately: a late cancelled result must not replace the new execution.
    await run.click();
    await expect(resultStatus).toBeVisible();
    await panel.reload();
    await openTab(panel, 'SuiteQL');
    await expect(editor).toContainText('SELECT id, tranid');
    await expect(panel.getByRole('table', { name: 'Query results' })).toHaveCount(0);
    await editor.fill('SELECT missing_column FROM transaction');
    await run.click();
    await expect(panel.getByRole('alert')).toBeVisible();
    await panel.getByText('Details', { exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('Fixture mode supports');
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Console: paging, parameters, history, snippets, exports, index and full tab (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
    context,
  }) => {
    await openNetSuite(`${SANDBOX}${SO_PATH}`);
    const panel = await openSidePanel();
    await panel.emulateMedia({ colorScheme });
    await panel.setViewportSize({ width: 390, height: 844 });
    await panel.getByRole('button', { name: 'Field list actions' }).click();
    await panel.getByRole('menuitem', { name: /^Query in SuiteQL/ }).click();
    const editor = panel.getByRole('textbox', { name: 'SuiteQL editor' });
    await expect(editor).toContainText('SELECT * FROM transaction WHERE id = 1001');
    await editor.fill('SELECT id, tranid FROM transaction WHERE ROWNUM <= ? ORDER BY id');
    await panel.getByLabel('Parameter type 1', { exact: true }).selectOption('number');
    await panel.getByLabel('Parameter value 1', { exact: true }).fill('6001');
    await panel.getByRole('button', { name: 'Run query', exact: true }).click();
    await expect(panel.getByRole('progressbar')).toBeVisible();
    await expect(panel.getByRole('status').filter({ hasText: /6,001 rows ·/ })).toBeVisible();
    const viewport = panel.getByRole('table', { name: 'Query results' }).locator('..');
    await viewport.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(panel.getByRole('table', { name: 'Query results' })).toContainText('SO-DEMO-6001');
    // Stop between pages; no final result is exposed after cancellation.
    await panel.getByRole('button', { name: 'Run query', exact: true }).click();
    await expect(panel.getByRole('status').filter({ hasText: /1,000 rows fetched/ })).toBeVisible();
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(panel.getByRole('status').filter({ hasText: 'Query cancelled' })).toBeVisible();
    await panel.getByRole('button', { name: 'Query options' }).click();
    await panel.getByLabel('Maximum rows (1–100,000)').fill('1500');
    await panel.getByRole('button', { name: 'Run query', exact: true }).click();
    await expect(panel.getByRole('status').filter({ hasText: /1,500 rows ·/ })).toBeVisible();
    await expect(
      panel.getByText('The configured row limit was reached. More rows may exist.'),
    ).toBeVisible();
    await panel.screenshot({ path: `/tmp/suitelens-console-${colorScheme}.png` });
    const csvDownload = panel.waitForEvent('download');
    await panel.getByRole('button', { name: 'Export CSV', exact: true }).click();
    const csv = await csvDownload;
    expect(csv.suggestedFilename()).toBe('suitelens-results.csv');
    await panel.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            document.documentElement.dataset.copiedText = text;
          },
        },
      });
    });
    await panel.getByRole('button', { name: 'Copy as Markdown table', exact: true }).click();
    await expect(panel.locator('html')).toHaveAttribute('data-copied-text', /\| id \| tranid \|/);
    await panel.getByRole('button', { name: 'History, snippets & metadata' }).click();
    await panel.getByLabel('Snippet name', { exact: true }).fill('Paged transactions');
    await panel.getByLabel('Description', { exact: true }).fill('Reusable parameter example');
    await panel.getByLabel('Tags (comma separated)', { exact: true }).fill('paging, demo');
    await panel.getByRole('button', { name: 'Save snippet', exact: true }).click();
    await expect(
      panel.getByRole('button', { name: 'Paged transactions', exact: true }),
    ).toBeVisible();
    const snippetDownload = panel.waitForEvent('download');
    await panel.getByRole('button', { name: 'Export snippets as JSON', exact: true }).click();
    const file = await snippetDownload;
    const path = await file.path();
    expect(path).toBeTruthy();
    await panel.getByRole('button', { name: 'Delete snippet', exact: true }).click();
    await panel.getByLabel('Import snippets from JSON', { exact: true }).setInputFiles(path!);
    await panel.getByRole('button', { name: 'Paged transactions', exact: true }).click();
    // Applying a snippet closes the drawer so the editor is visible.
    await expect(panel.getByLabel('Parameter value 1', { exact: true })).toHaveValue('6001');
    await panel.getByRole('button', { name: 'History, snippets & metadata' }).click();
    await panel.getByRole('button', { name: 'Start / resume indexing', exact: true }).click();
    await expect(
      panel.getByRole('status').filter({ hasText: /1 table · Last indexed/ }),
    ).toBeVisible();
    await panel.getByRole('button', { name: 'Pause indexing', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Pause indexing', exact: true })).toBeDisabled();
    await panel.getByRole('button', { name: 'Start / resume indexing', exact: true }).click();
    await expect(
      panel.getByRole('status').filter({ hasText: /4 tables · Last indexed/ }),
    ).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Pause indexing', exact: true })).toBeDisabled();
    await panel.getByRole('button', { name: 'Close', exact: true }).click();
    // The alias appears before its FROM clause in an ordinary SELECT.
    await editor.fill('SELECT t. FROM transaction t');
    await editor.press('ControlOrMeta+Home');
    for (let i = 0; i < 9; i++) await editor.press('ArrowRight');
    await editor.press('Control+Space');
    await expect(panel.getByRole('option').filter({ hasText: 'tranid' })).toBeVisible();
    await editor.press('Escape');
    const tabEvent = context.waitForEvent('page');
    await panel.getByRole('button', { name: 'Open console in full tab', exact: true }).click();
    const full = await tabEvent;
    await expect(full).toHaveURL(/console\.html\?targetTab=\d+/);
    await expect(full.getByRole('textbox', { name: 'SuiteQL editor' })).toContainText('SELECT t.');
    await full.close();
    await panel.reload();
    await openTab(panel, 'SuiteQL');
    await panel.getByRole('button', { name: 'History, snippets & metadata' }).click();
    await expect(
      panel.getByRole('button', { name: 'Paged transactions', exact: true }),
    ).toBeVisible();
    await expect(
      panel.getByRole('status').filter({ hasText: /4 tables · Last indexed/ }),
    ).toBeVisible();
    await panel.getByLabel('Search history and snippets', { exact: true }).fill('Paged');
    await expect(
      panel.getByRole('button', { name: 'Paged transactions', exact: true }).locator('mark'),
    ).toHaveText('Paged');
    await panel.getByLabel('Search history and snippets', { exact: true }).fill('ROWNUM');
    await expect(panel.locator('mark').first()).toHaveText(/ROWNUM/i);
    await expect(panel.locator('mark').first()).toBeVisible();
    await panel.getByLabel('Search history and snippets', { exact: true }).fill('not-present');
    await expect(
      panel.getByRole('button', { name: 'Paged transactions', exact: true }),
    ).toHaveCount(0);
  });
}

test('Console library: account isolation, cache clearing and all-data deletion', async ({
  openNetSuite,
  openSidePanel,
}) => {
  const account = await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  await openTab(panel, 'SuiteQL');
  await panel
    .getByRole('textbox', { name: 'SuiteQL editor' })
    .fill('SELECT id FROM transaction WHERE ROWNUM <= 10');
  await panel.getByRole('button', { name: 'Run query', exact: true }).click();
  await expect(panel.getByRole('status').filter({ hasText: /10 rows ·/ })).toBeVisible();
  await panel.getByRole('button', { name: 'History, snippets & metadata' }).click();
  await panel.getByLabel('Snippet name', { exact: true }).fill('Private sandbox snippet');
  await panel.getByRole('button', { name: 'Save snippet', exact: true }).click();
  await panel
    .getByLabel('Import catalog JSON (name, columns, source)', { exact: true })
    .setInputFiles({
      name: 'catalog.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify([{ name: 'transaction', columns: ['id', 'tranid'], source: 'imported' }]),
      ),
    });
  await expect(
    panel.getByRole('status').filter({ hasText: /1 table · Last indexed/ }),
  ).toBeVisible();
  await account.goto(`${PRODUCTION}${SO_PATH}`);
  await expect(panel.getByTestId('env-pill')).toHaveText('Production');
  await panel.getByRole('button', { name: 'History, snippets & metadata' }).click();
  await expect(
    panel.getByRole('button', { name: 'Private sandbox snippet', exact: true }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole('status').filter({ hasText: /0 tables · Last indexed/ }),
  ).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Clear query history' })).toBeDisabled();
  await account.goto(`${SANDBOX}${SO_PATH}`);
  await expect(panel.getByTestId('env-pill')).toHaveText('Sandbox');
  await panel.getByRole('button', { name: 'History, snippets & metadata' }).click();
  await expect(
    panel.getByRole('button', { name: 'Private sandbox snippet', exact: true }),
  ).toBeVisible();
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await openSettings(panel);
  await panel.getByRole('button', { name: 'Clear cache for this account', exact: true }).click();
  await expect(panel.getByRole('status').filter({ hasText: /Cache cleared/ })).toBeVisible();
  await openTab(panel, 'SuiteQL');
  await panel.getByRole('button', { name: 'History, snippets & metadata' }).click();
  await expect(
    panel.getByRole('button', { name: 'Private sandbox snippet', exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole('status').filter({ hasText: /0 tables · Last indexed/ }),
  ).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Clear query history' })).toBeEnabled();
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await openSettings(panel);
  await panel.getByRole('button', { name: 'Delete all SuiteLens data', exact: true }).click();
  await panel.getByRole('button', { name: 'Confirm', exact: true }).click();
  // Delete all data resets the first-open preference as well as drafts and libraries.
  await expect(panel.getByRole('dialog')).toContainText('Step 1 of 3');
  await panel.getByRole('button', { name: 'Skip tour' }).click();
  await panel.getByRole('button', { name: 'Close tips' }).click();
  await expect(
    panel.getByRole('status').filter({ hasText: 'All SuiteLens data deleted' }),
  ).toBeVisible();
  await openTab(panel, 'SuiteQL');
  await panel.getByRole('button', { name: 'History, snippets & metadata' }).click();
  await expect(
    panel.getByRole('button', { name: 'Private sandbox snippet', exact: true }),
  ).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Clear query history' })).toBeDisabled();
});
