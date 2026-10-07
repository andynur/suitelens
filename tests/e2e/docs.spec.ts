import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';

test('static docs navigation, privacy and narrow-screen layout', async ({ page }) => {
  const destination = resolve('artifacts/launch');
  await mkdir(destination, { recursive: true });
  const root = pathToFileURL(resolve('.site/index.html')).href;
  await page.goto(root);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('NetSuite context');
  await page.getByRole('navigation').getByRole('link', { name: 'Privacy', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Privacy Policy');
  await expect(page.getByRole('main')).toContainText('Agent names are self-reported');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: resolve(destination, 'docs-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('navigation').getByRole('link', { name: 'MCP', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Local MCP setup');
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport);
  await page.screenshot({ path: resolve(destination, 'docs-mobile.png') });
  await page.getByRole('navigation').getByRole('link', { name: 'FAQ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible();
});
