import type { Page } from '@playwright/test';
import { expect, SANDBOX, SO_PATH, test, openTab, navigationNames, openSettings } from './harness';

/** Options fold into a summary line after a scan (ADR 0051); reopen them before editing. */
async function openOptions(panel: Page) {
  const button = panel.getByRole('button', { name: 'Scan options' });
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
}

/** The Coverage section below the results is collapsed by default. */
async function openCoverage(panel: Page) {
  const details = panel.locator('details', { hasText: 'Coverage: what was checked' }).first();
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open)))
    await details.locator('summary').first().click();
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Impact plans saved searches from page links before reading definitions (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}/app/common/search/searchlist.nl`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'Impact');
    await panel.getByText('Advanced: choose files manually').click();
    await panel.getByRole('button', { name: 'Add searches linked on this page' }).click();
    await expect(panel.getByLabel('File Cabinet files')).toHaveValue('saved-search:503');
    await expect(panel.getByText('Linked searches found: 1 · Added to draft: 1.')).toBeVisible();
    await expect(panel.getByText('Demo flagged orders', { exact: true })).toHaveCount(0);
    await expect(panel.getByText('Scan complete', { exact: true })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Add searches linked on this page' }).click();
    await expect(panel.getByLabel('File Cabinet files')).toHaveValue('saved-search:503');
    await expect(panel.getByText('Linked searches found: 1 · Added to draft: 0.')).toBeVisible();
    await panel.getByLabel('Field, script or saved search ID').fill('custbody_demo_flag');
    await panel.getByRole('button', { name: 'Scan or restore' }).click();
    await expect(panel.getByText('Scan complete', { exact: true })).toBeVisible();
    await expect(panel.getByRole('region', { name: 'Saved searches', exact: true })).toContainText(
      'Demo flagged orders',
    );
  });

  test(`Impact keeps unmatched script activity unknown (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}${SO_PATH}`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'Impact');
    await panel.getByLabel('Field, script or saved search ID').fill('custbody_demo_flag');
    await panel.getByText('Advanced: choose files manually').click();
    await panel.getByLabel('File Cabinet files').fill('script:501');
    await panel.getByRole('button', { name: 'Scan or restore' }).click();
    await expect(panel.getByText('Scan complete', { exact: true })).toBeVisible();
    // Script metadata is read once the scan completes (ADR 0051).
    await openCoverage(panel);
    const metadata = panel.getByRole('region', { name: 'Matching script records' });
    await expect(metadata).toContainText('0 enabled · 0 inactive · 0 activity unknown');
    await expect(metadata).toContainText('Matching script files without record metadata: 1');
    await expect(metadata).toContainText('Activity remains unknown');
    await expect(metadata).toContainText('for salesorder only');
    await expect(metadata.getByRole('link')).toHaveCount(0);
    await panel.getByLabel('Field, script or saved search ID').fill('custbody_other');
    await expect(panel.getByRole('region', { name: 'Matching script records' })).toHaveCount(0);
  });

  test(`Impact reads an explicit unsaved PDF editor snapshot (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    const editorPath = '/app/common/custom/advancedprint/pdftemplate.nl?id=3&nl=T&source=F&e=T';
    await openNetSuite(`${SANDBOX}${editorPath}`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'Impact');
    const editor = panel.getByRole('region', { name: 'Open PDF editor', exact: true });
    const scan = editor.getByRole('button', { name: 'Scan open PDF editor' });
    await expect(scan).toBeDisabled();
    await panel.getByLabel('Field, script or saved search ID').fill('custbody_demo_flag');
    await expect(scan).toBeEnabled();
    await expect(editor.getByRole('link')).toHaveCount(0);
    await scan.click();
    await expect(editor).toContainText('Unsaved template customization');
    await expect(editor).toContainText('Line 4, column 13');
    await expect(editor).toContainText('Kept in memory only');
    await expect(editor.getByRole('link', { name: /Open editor in NetSuite/ })).toHaveAttribute(
      'href',
      `${SANDBOX}${editorPath}`,
    );
    await panel.getByLabel('Field, script or saved search ID').fill('custbody_missing');
    await expect(editor.getByRole('link')).toHaveCount(0);
    await scan.click();
    await expect(editor).toContainText('No candidate references in this editor snapshot.');
    await expect(panel.getByText('Scan complete', { exact: true })).toHaveCount(0);
  });

  test(`Impact finds UE, saved search and PDF references with correct links (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}/app/common/entity/custjoblist.nl`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'Impact');
    await panel.getByLabel('Field, script or saved search ID').fill('custbody_demo_flag');
    await panel.getByText('Advanced: choose files manually').click();
    await panel
      .getByLabel('File Cabinet files')
      .fill('script:501\npdf-template:502\nsaved-search:503');
    await panel.getByRole('button', { name: 'Scan or restore' }).click();
    await expect(panel.getByText('Scan complete', { exact: true })).toBeVisible();
    for (const [name, id] of [
      ['Script files', '501'],
      ['PDF templates', '502'],
    ] as const) {
      const source = panel.getByRole('region', { name, exact: true });
      await expect(source).toContainText('Line 5');
      const link = source.getByRole('link', { name: /Open source in NetSuite/ });
      await expect(link).toHaveAttribute(
        'href',
        `${SANDBOX}/core/media/media.nl?id=${id}&h=fake-fixture`,
      );
      await expect(link).toHaveAttribute('rel', 'noreferrer noopener');
    }
    const search = panel.getByRole('region', { name: 'Saved searches', exact: true });
    await expect(search).toContainText('Demo flagged orders');
    await expect(search).toContainText('Filter 1');
    await expect(search.getByRole('link', { name: /Open in NetSuite/ })).toHaveAttribute(
      'href',
      `${SANDBOX}/app/common/search/search.nl?id=503`,
    );
    await expect(panel.getByText('Not checked', { exact: true })).toHaveCount(0);
    await openCoverage(panel);
    await expect(panel.getByRole('button', { name: 'Load script metadata' })).toBeDisabled();
    // File names load automatically after the scan.
    await expect(panel.getByRole('region', { name: 'Script files', exact: true })).toContainText(
      'ue_demo_flag.js',
    );
    await expect(panel.getByText(/Names read for 1 of 2 planned files/)).toBeVisible();
    await expect(panel.getByRole('region', { name: 'PDF templates', exact: true })).toContainText(
      'File #502',
    );
    await openOptions(panel);
    await panel.getByRole('button', { name: 'Scan or restore' }).click();
    await expect(panel.getByText('Scan complete', { exact: true })).toBeVisible();
    await expect(panel.getByRole('link', { name: /Open source in NetSuite/ })).toHaveCount(0);
    // Listed once for the scan, not on every file card.
    await expect(panel.getByText(/Source link unavailable/)).toHaveCount(1);
    await expect(panel.getByRole('region', { name: 'Script files', exact: true })).toContainText(
      'ue_demo_flag.js',
    );
    await panel.getByRole('button', { name: 'Rescan from source' }).click();
    await expect(panel.getByText('Scan complete', { exact: true })).toBeVisible();
    await expect(panel.getByRole('link', { name: /Open source in NetSuite/ })).toHaveCount(2);
  });

  test(`Impact indexes reuse identifiers and honor account opt-out (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}/app/common/entity/custjoblist.nl`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'Impact');
    await panel.getByLabel('Field, script or saved search ID').fill('custbody_demo_flag');
    await panel.getByText('Advanced: choose files manually').click();
    await panel.getByLabel('File Cabinet files').fill('script:501');
    await panel.getByRole('button', { name: 'Scan or restore' }).click();
    await expect(panel.getByText('Scan complete', { exact: true })).toBeVisible();
    await panel.getByLabel('Field, script or saved search ID').fill('beforeSubmit');
    await openOptions(panel);
    await panel.getByRole('button', { name: 'Scan or restore' }).click();
    await expect(panel.getByText(/Results use a local index/)).toBeVisible();
    await openOptions(panel);
    await panel.getByRole('switch', { name: 'Remember script index for this account' }).click();
    await expect(
      panel.getByRole('switch', { name: 'Remember script index for this account' }),
    ).not.toBeChecked();
    await panel.getByLabel('Field, script or saved search ID').fill('order');
    await openOptions(panel);
    await panel.getByRole('button', { name: 'Scan or restore' }).click();
    await expect(panel.getByText('Code excerpt · line 4', { exact: true })).toBeVisible();
    await expect(panel.getByText(/Results use a local index/)).toHaveCount(0);
    await openSettings(panel);
    await openTab(panel, 'Impact');
    await expect(
      panel.getByRole('switch', { name: 'Remember script index for this account' }),
    ).not.toBeChecked();
  });

  test(`Impact reference summary preserves source coverage and counts under filtering (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}/app/common/entity/custjoblist.nl`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'Impact');
    await panel.getByLabel('Field, script or saved search ID').fill('custbody_demo_flag');
    await panel.getByText('Advanced: choose files manually').click();
    await panel
      .getByLabel('File Cabinet files')
      .fill('script:501\npdf-template:502\nsaved-search:503\nsaved-search:999');
    await panel.getByRole('button', { name: 'Scan or restore' }).click();
    await expect(panel.getByText('Scan complete', { exact: true })).toBeVisible();
    await openCoverage(panel);
    const summary = panel.getByRole('region', { name: 'Reference summary' });
    for (const name of [/Script files/, /PDF templates/, /Saved searches/]) {
      const row = summary.getByRole('row', { name });
      await expect(row.getByRole('cell').first()).toHaveText('1');
      expect(Number(await row.getByRole('cell').nth(1).textContent())).toBeGreaterThan(0);
    }
    await expect(summary.getByRole('row', { name: /Saved searches/ })).toContainText(
      '1 not fully checked',
    );
    await expect(summary).toContainText('1 public · 0 not public · 0 unknown visibility');
    await expect(summary).toContainText('Change risk cannot be determined');
    const counts = await summary.innerText();
    await panel.getByRole('button', { name: /^No references/ }).click();
    await expect(panel.getByText('No files match this filter.').first()).toBeVisible();
    expect(await summary.innerText()).toBe(counts);
    await openOptions(panel);
    await panel.getByRole('button', { name: 'Scan or restore' }).click();
    await expect(panel.getByText('Scan complete', { exact: true })).toBeVisible();
    await openCoverage(panel);
    expect(await summary.innerText()).toBe(counts);
    expect(
      await panel.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  });

  test(`Impact explicitly excludes selected library filenames (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}/app/common/entity/custjoblist.nl`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'Impact');
    await panel.getByLabel('Field, script or saved search ID').fill('custbody_demo_flag');
    const toggle = panel.getByRole('switch', { name: /^Exclude selected library file names/ });
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await panel.getByLabel('Library file names to exclude').fill('ue_demo_flag.js');
    await panel.getByRole('button', { name: 'Scan', exact: true }).click();
    await expect(panel.getByText('Scan complete', { exact: true })).toBeVisible();
    await expect(panel.getByText('1 of 1 source processed')).toBeVisible();
    await openCoverage(panel);
    await panel.getByText('1 library file skipped by your filename exclusions').click();
    await expect(panel.getByText('Skipped: excluded library', { exact: true })).toBeVisible();
    await expect(panel.getByText(/Skipped files are outside the scan plan/)).toBeVisible();
    await expect(
      panel.getByRole('region', { name: 'Script files', exact: true }),
    ).not.toContainText('ue_demo_flag.js');
    await openOptions(panel);
    await toggle.click();
    await expect(panel.getByText('Scan complete', { exact: true })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Scan', exact: true }).click();
    await expect(panel.getByText('2 of 2 sources processed')).toBeVisible();
    await expect(panel.getByRole('region', { name: 'Script files', exact: true })).toContainText(
      'ue_demo_flag.js',
    );
    await expect(panel.getByText('Skipped: excluded library', { exact: true })).toHaveCount(0);
  });

  test(`Impact scans all discovered script files from one input (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}/app/common/entity/custjoblist.nl`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'Impact');
    await expect(panel.getByRole('button', { name: 'Scan', exact: true })).toBeDisabled();
    await panel.getByLabel('Field, script or saved search ID').fill('custbody_demo_flag');
    await panel.getByRole('button', { name: 'Scan', exact: true }).click();
    await expect(panel.getByText('Scan complete', { exact: true })).toBeVisible();
    await openCoverage(panel);
    await expect(panel.getByText('2 script files will be read.')).toBeVisible();
    await expect(panel.getByRole('region', { name: 'Script files' })).toContainText(
      'ue_demo_flag.js',
    );
    await panel.getByRole('button', { name: 'Scan', exact: true }).click();
    await expect(panel.getByText('Scan complete', { exact: true })).toBeVisible();
    await expect(panel.getByText(/Results use a local index/)).toBeVisible();
    await expect(panel.getByText('Code excerpt · line 5', { exact: true })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Rescan from source' }).click();
    await expect(panel.getByText('Scan complete', { exact: true })).toBeVisible();
    await expect(panel.getByText('Code excerpt · line 5', { exact: true })).toBeVisible();
  });

  test(`Impact: supplied-file coverage, cache, refresh and setting (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}/app/common/entity/custjoblist.nl`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    await openTab(panel, 'Impact');
    await panel.getByText('Advanced: choose files manually').click();
    await expect(panel.getByRole('button', { name: 'Scan or restore' })).toBeDisabled();
    await panel.getByLabel('Field, script or saved search ID').fill('custbody_demo_flag');
    await panel.getByLabel('File Cabinet files').fill('script:501\npdf-template:502\nscript:999');
    await panel.getByRole('button', { name: 'Scan or restore' }).click();
    await expect(panel.getByText('Scan complete', { exact: true })).toBeVisible();
    await expect(panel.getByText('3 of 3 sources processed')).toBeVisible();
    await expect(panel.getByRole('region', { name: 'Script files' })).toContainText('File #501');
    await expect(panel.getByRole('region', { name: 'PDF templates' })).toContainText(
      'possible reference',
    );
    await expect(panel.getByText('Not checked', { exact: true })).toBeVisible();
    await openCoverage(panel);
    await expect(panel.getByText(/zero matches do not mean/)).toBeVisible();
    await expect(panel.getByText(/Change risk cannot be determined/)).toBeVisible();
    await panel.getByText('Script dependencies', { exact: true }).first().click();
    await expect(panel.getByText('N/record', { exact: true })).toBeVisible();
    await panel.getByText('Code excerpt · line 5', { exact: true }).click();
    await expect(panel.getByText(/5:.*getValue/).first()).toBeVisible();
    await expect(
      panel.getByText('Dynamically built prefix', { exact: true }).first(),
    ).toBeVisible();
    await openSettings(panel);
    await openTab(panel, 'Impact');
    await expect(panel.getByText('No scan yet', { exact: true })).toBeVisible();
    await panel.getByLabel('Field, script or saved search ID').fill('custbody_demo_flag');
    await panel.getByText('Advanced: choose files manually').click();
    await panel.getByLabel('File Cabinet files').fill('script:501\npdf-template:502\nscript:999');
    await panel.getByRole('button', { name: 'Scan or restore' }).click();
    await expect(panel.getByText('Scan complete', { exact: true })).toBeVisible();
    await expect(panel.getByText('Code excerpt · line 5', { exact: true })).toHaveCount(0);
    await expect(panel.getByText(/Some excerpts are unavailable/)).toBeVisible();
    await panel.getByRole('button', { name: 'Rescan from source' }).click();
    await expect(panel.getByText('Scan complete', { exact: true })).toBeVisible();
    await panel.getByText('Code excerpt · line 5', { exact: true }).click();
    await expect(panel.getByText(/5:.*getValue/).first()).toBeVisible();
    const overflow = await panel.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
    await openSettings(panel);
    await panel.getByRole('switch', { name: /^Impact Analysis/ }).click();
    expect(await navigationNames(panel)).not.toContain('Impact');
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Impact shortcuts prefill identifiers without starting scans (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}${SO_PATH}`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    const field = panel.locator('[data-field-id="memo"]');
    await field.hover();
    await field.getByRole('button', { name: 'Check impact of memo' }).click();
    await expect(panel.getByLabel('Field, script or saved search ID')).toHaveValue('memo');
    await panel.getByText('Advanced: choose files manually').click();
    await expect(panel.getByLabel('File Cabinet files')).toHaveValue('');
    await expect(panel.getByRole('button', { name: 'Scan or restore' })).toBeDisabled();
    await expect(panel.getByText('No scan yet', { exact: true })).toBeVisible();
    await openTab(panel, 'Automation');
    await panel.getByText('customscript_suitelens_so_cs', { exact: true }).click();
    await panel
      .getByRole('button', { name: 'Check impact of customscript_suitelens_so_cs' })
      .click();
    await expect(panel.getByLabel('Field, script or saved search ID')).toHaveValue(
      'customscript_suitelens_so_cs',
    );
    await expect(panel.getByLabel('File Cabinet files')).toHaveValue('');
    await expect(panel.getByText('No scan yet', { exact: true })).toBeVisible();
    await openSettings(panel);
    await panel.getByRole('switch', { name: /^Impact Analysis/ }).click();
    await openTab(panel, 'Fields');
    await expect(field.getByRole('button', { name: 'Check impact of memo' })).toHaveCount(0);
  });
}
