import { expect, openTab, PRODUCTION, SANDBOX, SO_PATH, test, openSettings } from './harness';

const banner = '#netsuite-suitelens-env-banner';

test('Settings tab: Environment Guard banner uses the configured color and label', async ({
  openNetSuite,
  openSidePanel,
}) => {
  const page = await openNetSuite(`${SANDBOX}${SO_PATH}`);
  await expect(page.locator(banner)).toHaveAttribute('data-environment', 'sandbox');
  const pill = page.locator(`${banner} .pill`);
  await expect(pill).toHaveText('1234567-SB1 · Sandbox');
  await expect(pill).toHaveCSS('background-color', 'rgb(248, 195, 90)');
  // Light sandbox amber gets dark text for contrast.
  await expect(pill).toHaveCSS('color', 'rgb(31, 31, 33)');

  const panel = await openSidePanel();
  await openSettings(panel);
  const label = panel.getByRole('textbox', { name: 'Banner label' });
  await label.fill('ACME – SANDBOX');
  await label.press('Enter');
  await expect(pill).toHaveText('ACME – SANDBOX');

  await panel.getByRole('switch', { name: /Environment Guard/ }).click();
  await expect(page.locator(banner)).toHaveCount(0);
});

test('Settings tab: production gets the red banner; theme switches to dark', async ({
  openNetSuite,
  openSidePanel,
}) => {
  const page = await openNetSuite(`${PRODUCTION}${SO_PATH}`);
  await expect(page.locator(`${banner} .pill`)).toHaveCSS('background-color', 'rgb(220, 38, 38)');

  const panel = await openSidePanel();
  await openSettings(panel);
  await panel.getByRole('radio', { name: 'Dark' }).check();
  await expect(panel.locator('html')).toHaveClass(/dark/);
  await expect(
    panel.getByText('NetSuite is a trademark of Oracle Corporation', { exact: false }),
  ).toBeVisible();
});

test('Quick Go-to opens a record URL and remembers it per account', async ({
  openNetSuite,
  openSidePanel,
  context,
}) => {
  await openNetSuite(`${SANDBOX}${SO_PATH}`);
  const panel = await openSidePanel();
  // Go to record lives on Home and in the command bar (ADR 0052).
  await openTab(panel, 'Home');
  await panel.getByRole('combobox', { name: 'Record type' }).selectOption('customer');
  await panel.getByRole('textbox', { name: 'Internal ID' }).fill('2001');
  await panel.getByRole('checkbox', { name: 'Open in new tab' }).check();
  const newPage = context.waitForEvent('page');
  await panel.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(await newPage).toHaveURL(`${SANDBOX}/app/common/entity/custjob.nl?id=2001`);
  await expect(
    panel.getByRole('listitem').getByRole('button', { name: 'customer #2001' }),
  ).toBeVisible();
});

test('Environment Guard: preserves the favicon under a strict NetSuite image CSP', async ({
  context,
  openNetSuite,
  openSidePanel,
}) => {
  await context.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { suitelensCspViolations: violations });
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.effectiveDirective}: ${event.blockedURI}`);
    });
  });
  await context.route('**/salesord.nl?*', async (route) => {
    const { readFileSync } = await import('node:fs');
    const html = readFileSync('fixtures/pages/salesorder-view.html', 'utf8');
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      headers: { 'Content-Security-Policy': "img-src 'self'" },
      body: html,
    });
  });
  const page = await openNetSuite(`${SANDBOX}${SO_PATH}`);
  await expect(page.locator(banner)).toBeAttached();
  const panel = await openSidePanel();
  await openSettings(panel);
  const label = panel.getByRole('textbox', { name: 'Banner label' });
  await label.fill('CSP sandbox');
  await label.press('Enter');
  await expect(page.locator(`${banner} .pill`)).toHaveText('CSP sandbox');
  // Cover the old asynchronous favicon loader's 3-second timeout and fallback.
  await page.waitForTimeout(3500);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.ico');
  await expect(page.locator('link[data-suitelens-favicon]')).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, 'suitelensCspViolations'))).toEqual([]);
});
