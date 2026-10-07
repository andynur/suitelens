import { readFile } from 'node:fs/promises';
import { expect, SANDBOX, SO_PATH, test, openTab } from './harness';

// Fixture builds use the built-in demo AI provider: no key, no network (ADR 0041).
for (const colorScheme of ['light', 'dark'] as const) {
  test(`AI: preview, cancel, SuiteQL answer opens in Console (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}${SO_PATH}`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    // Provider, key and limits live in the drawer's AI setup section (ADR 0053).
    await panel.getByRole('button', { name: 'AI Assistant', exact: true }).click();
    const drawer = panel.getByRole('complementary', { name: 'AI Assistant' });
    await drawer.getByRole('heading', { name: 'AI setup' }).click();
    await drawer.getByLabel('Provider', { exact: true }).selectOption('commandcode');
    await expect(drawer.getByLabel('Model ID', { exact: true })).toHaveValue(
      'deepseek/deepseek-v4-flash',
    );
    await expect(drawer.getByText(/Zero data retention is required/)).toBeVisible();
    await drawer.getByLabel('Provider', { exact: true }).selectOption('gemini');
    await expect(drawer.getByLabel('Model ID', { exact: true })).toHaveValue('gemini-3.8-flash');
    await expect(drawer.getByText(/Do not send confidential or personal data/)).toBeVisible();
    await expect(drawer.getByText('Google Gemini · gemini-3.8-flash')).toBeVisible();
    await drawer.getByRole('heading', { name: 'AI setup' }).click();

    const question = panel.getByRole('textbox', { name: 'Question' });
    await question.fill('List the 10 latest sales orders with customer names');
    await panel.getByRole('button', { name: 'Ask', exact: true }).click();

    // The preview shows the full payload; cancelling sends nothing.
    const dialog = panel.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: /Content of Question/ })).toHaveValue(
      'List the 10 latest sales orders with customer names',
    );
    await expect(dialog.getByText(/input tokens in total/)).toBeVisible();
    await expect(dialog.getByText(/Do not send confidential or personal data/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(panel.getByText('AI response')).toHaveCount(0);
    await expect(panel.getByText('Waiting for the AI response…')).toHaveCount(0);

    await panel.getByRole('button', { name: 'Ask', exact: true }).click();
    await panel.getByRole('dialog').getByRole('button', { name: 'Send' }).click();
    await expect(panel.getByText(/WHERE ROWNUM <= 10/).first()).toBeVisible();
    await expect(panel.getByText(/Input \d+ tokens · output \d+ tokens/)).toBeVisible();
    await expect(panel.getByText('Check before running')).toHaveCount(0);

    await panel.getByRole('button', { name: 'Open in SuiteQL' }).first().click();
    await expect(panel.getByRole('complementary', { name: 'AI Assistant' })).toHaveCount(0);
    await expect(panel.getByRole('tab', { name: 'SuiteQL', exact: true })).toHaveAttribute(
      'data-state',
      'active',
    );
    const editor = panel.getByRole('textbox', { name: 'SuiteQL editor' });
    await expect(editor).toContainText("t.type = 'SalesOrd'");
    // Never executed automatically.
    await expect(panel.getByRole('table', { name: 'Query results' })).toHaveCount(0);
  });

  test(`AI: explain a script file and export Sales Order context (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}${SO_PATH}`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await panel.getByRole('button', { name: 'AI Assistant', exact: true }).click();

    await panel.getByLabel('Script on this record type').selectOption({
      label: 'Other file (enter its ID)',
    });
    await panel.getByRole('textbox', { name: 'File Cabinet file ID' }).fill('501');
    await panel.getByRole('button', { name: 'Explain', exact: true }).click();
    const dialog = panel.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Send' }).click();
    await expect(panel.getByText(/SuiteScript 2\.x User Event script/)).toBeVisible();
    await expect(panel.getByText(/Input \d+ tokens · output \d+ tokens/)).toBeVisible();

    // AI Context Export lives in Docs (ADR 0052).
    await panel.getByRole('button', { name: 'Close AI Assistant' }).click();
    await openTab(panel, 'Docs');
    await panel.getByRole('button', { name: 'Generate' }).click();
    await expect(panel.getByText(/body fields \(\d+ custom\)/)).toBeVisible();
    const downloading = panel.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download', exact: true }).click();
    await panel.getByRole('menuitem', { name: 'Download .md' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('salesorder.md');
    const markdown = await readFile((await download.path())!, 'utf8');
    expect(markdown).toContain('custbody_');
    expect(markdown).toContain('Demo Priority (ambiguous)');
    const related = markdown
      .split('## Related custom records')[1]!
      .split('## Account custom record index')[0]!;
    expect(related).toContain('No confirmed outgoing references');
    expect(related).not.toContain('customrecord_suitelens_demo');
    expect(markdown.split('## Account custom record index')[1]).toContain(
      'customrecord_suitelens_demo',
    );
    expect(markdown).not.toContain('customlist_demo_priority');
    expect(markdown).not.toContain('1234567');

    await panel
      .getByRole('textbox', { name: 'Record type', exact: true })
      .fill('customrecord_suitelens_demo');
    await panel.getByRole('button', { name: 'Generate', exact: true }).click();
    const preview = panel.getByLabel('Markdown preview', { exact: true });
    await expect(preview).toContainText('Selected custom record field identifiers');
    await expect(preview).toContainText('custrecord_demo_field');
    await expect(preview).toContainText('Coverage: partial');
    const jsonDownloading = panel.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download', exact: true }).click();
    await panel.getByRole('menuitem', { name: 'Download .json' }).click();
    const jsonDownload = await jsonDownloading;
    expect(jsonDownload.suggestedFilename()).toBe('customrecord_suitelens_demo.json');
    const json = JSON.parse(await readFile((await jsonDownload.path())!, 'utf8'));
    expect(json.bodyFields).toEqual([]);
    expect(json.sublists).toEqual([]);
    expect(json.selectedCustomRecordFields).toEqual({
      basis: 'custom-field-definitions',
      status: 'partial',
      fieldIds: ['custrecord_demo_field'],
    });
  });

  test(`AI: explain selected error logs (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}/app/common/entity/custjoblist.nl`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'Logs');
    await panel.getByLabel('Log level', { exact: true }).selectOption('ERROR');
    await panel.getByRole('button', { name: 'Select for AI' }).click();
    await panel
      .getByRole('checkbox', { name: /^Select ".*" for AI$/ })
      .first()
      .check();
    await expect(panel.getByText(/1 of 20 selected for AI/)).toBeVisible();
    await panel.getByRole('button', { name: 'Explain with AI' }).click();
    const dialog = panel.getByRole('dialog');
    await expect(dialog.getByText('Log').first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Send' }).click();
    await expect(panel.getByText(/Likely causes/).first()).toBeVisible();
  });
}
