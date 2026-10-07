import { test, expect, SANDBOX, SO_PATH, openTab, navigationNames, openSettings } from './harness';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Documentation: opt-in as-built preview, selected type and disabling (${colorScheme})`, async ({
    openNetSuite,
    openSidePanel,
  }) => {
    await openNetSuite(`${SANDBOX}${SO_PATH}`);
    const panel = await openSidePanel();
    await panel.setViewportSize({ width: 390, height: 820 });
    await panel.emulateMedia({ colorScheme });
    // Docs shows the AI agent context preset by default; the as-built preset is opt-in.
    await openTab(panel, 'Docs');
    await expect(panel.getByRole('radio', { name: 'As-built document' })).toHaveCount(0);
    await openSettings(panel);
    await panel.getByRole('switch', { name: /^Documentation Generator \(preview\)/ }).click();
    await openTab(panel, 'Docs');
    await expect(panel.getByRole('radio', { name: 'As-built document' })).toBeChecked();
    await expect(panel.getByText('No document yet', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Generate preview', exact: true }).click();
    const preview = panel.getByLabel('As-built preview', { exact: true });
    await expect(
      preview.getByRole('heading', { name: 'As-built draft: salesorder' }),
    ).toBeVisible();
    await expect(preview).toContainText('custbody_suitelens_priority');
    await expect(preview).toContainText('Forms/layouts: not checked');
    await expect(preview).toContainText('Integrations/RESTlets: not checked');
    await expect(preview).not.toContainText('1234567');
    await expect(panel.getByRole('button', { name: 'Download .md' })).toBeVisible();
    await panel
      .getByRole('textbox', { name: 'Record type', exact: true })
      .fill('customrecord_suitelens_demo');
    await expect(preview).toHaveCount(0);
    await panel.getByRole('button', { name: 'Generate preview', exact: true }).click();
    await expect(preview).toContainText('Selected custom record field identifiers');
    await expect(preview).toContainText('custrecord_demo_field');
    await openSettings(panel);
    await panel.getByRole('switch', { name: /^Documentation Generator \(preview\)/ }).click();
    await panel.getByRole('switch', { name: /^AI Context Export/ }).click();
    expect(await navigationNames(panel)).not.toContain('Docs');
  });
}
