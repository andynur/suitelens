import { expect, SANDBOX, SO_PATH, test, openTab } from './harness';

/** UX plan checks (docs/ux-improvement-plan.md) at a narrow side-panel size. */
const VIEWPORT = { width: 400, height: 720 };

test('Impact: the first file result is visible without scrolling after a scan', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  await panel.setViewportSize(VIEWPORT);
  await openTab(panel, 'Impact');
  await panel
    .getByLabel('Field, script or saved search ID', { exact: true })
    .fill('custbody_demo_flag');
  await panel.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(panel.getByText('Scan complete')).toBeAttached();
  const firstFile = panel.getByRole('region', { name: 'Script files' }).locator('li').first();
  await expect(firstFile).toBeInViewport();
});

test('Logs: the first log row is visible without scrolling', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite(`${SANDBOX}/app/common/entity/custjoblist.nl`);
  const panel = await openSidePanel();
  await panel.setViewportSize(VIEWPORT);
  await openTab(panel, 'Logs');
  const first = panel.getByRole('list', { name: 'Execution log groups' }).locator('li').first();
  await expect(first).toBeInViewport();
});

test('No tab shows more than one notice banner and icon buttons are labelled', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  await panel.setViewportSize(VIEWPORT);
  for (const tab of [
    'Fields',
    'Automation',
    'Raw data',
    'Related',
    'SuiteQL',
    'Logs',
    'Impact',
    'RESTlets',
    'Docs',
  ]) {
    await openTab(panel, tab);
    await expect(panel.getByRole('tab', { name: tab, exact: true })).toHaveAttribute(
      'data-state',
      'active',
    );
    // Let the tab settle (loading skeletons are replaced by content).
    await panel.waitForTimeout(300);
    const banners = await panel.locator('[role="tabpanel"]:not([hidden]) [data-banner]').count();
    expect(banners, tab).toBeLessThanOrEqual(1);
    const unlabelled = await panel.locator('button:visible').evaluateAll((buttons) =>
      buttons
        // Icon-only buttons (an SVG and no text) need an accessible name and a tooltip.
        .filter((button) => !button.textContent?.trim() && button.querySelector('svg'))
        .filter((button) => !button.getAttribute('aria-label') || !button.getAttribute('title'))
        .map((button) => button.className.slice(0, 120)),
    );
    expect(unlabelled, tab).toEqual([]);
  }
});

test('SuiteQL: the editor resizes with its handle and fits the query again', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  await panel.setViewportSize(VIEWPORT);
  await openTab(panel, 'SuiteQL');
  const editor = panel.locator('.cm-editor');
  const before = (await editor.boundingBox())!.height;
  const handle = panel.getByRole('separator', { name: 'Resize editor' });
  await handle.focus();
  await handle.press('End');
  await expect.poll(async () => (await editor.boundingBox())!.height).toBeGreaterThan(before + 100);
  await handle.press('Enter');
  await expect.poll(async () => (await editor.boundingBox())!.height).toBeLessThan(before + 4);
});

test('Fields: custom body fields open a one-field SuiteQL draft', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  await openTab(panel, 'Fields');
  const action = panel.getByRole('button', { name: /^Query custbody_\w+ in SuiteQL$/ }).first();
  const id = (await action.getAttribute('aria-label'))!.split(' ')[1]!;
  await action.click();
  await expect(panel.getByRole('textbox', { name: 'SuiteQL editor' })).toContainText(
    `SELECT id, ${id} FROM transaction`,
  );
  await expect(panel.getByRole('table', { name: 'Query results' })).toHaveCount(0);
});

test('AI Assistant: labelled toggle in the group row stays usable while open', async ({
  openNetSuite,
  openSidePanel,
}) => {
  await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  await panel.setViewportSize(VIEWPORT);
  const toggle = panel
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: 'AI Assistant', exact: true });
  await expect(toggle).toBeInViewport();
  await toggle.click();
  await expect(panel.getByRole('complementary', { name: 'AI Assistant' })).toBeVisible();
  // The drawer opens below the row, so the same button closes it.
  await toggle.click();
  await expect(panel.getByRole('complementary', { name: 'AI Assistant' })).toHaveCount(0);
});
