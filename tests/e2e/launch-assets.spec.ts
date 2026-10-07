import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test, expect, SANDBOX, SO_PATH, openTab, openSettings } from './harness';

// This is an explicit fixture-only media task, not part of the normal E2E gate.
test('capture fixture store screenshots and a 75-second demo', async ({
  context,
  extensionId,
  openNetSuite,
}) => {
  test.skip(
    process.env.SUITELENS_LAUNCH_ASSETS !== '1',
    'Run pnpm launch:assets to capture media.',
  );
  test.setTimeout(110_000);
  const destination = resolve('artifacts/launch');
  await mkdir(destination, { recursive: true });
  await openNetSuite(SANDBOX + SO_PATH);
  // A separate page uses the fixture build's existing state and never contacts a real account.
  const panel = await context.newPage();
  await panel.setViewportSize({ width: 1280, height: 800 });
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const started = Date.now();
  await expect(panel.getByRole('dialog')).toBeVisible();
  await panel.waitForTimeout(6000);
  await panel.getByRole('button', { name: 'Next', exact: true }).click();
  await panel.waitForTimeout(5000);
  await panel.getByRole('button', { name: 'Next', exact: true }).click();
  await panel.waitForTimeout(5000);
  await panel.getByRole('button', { name: 'Start exploring' }).click();
  await expect(panel.getByRole('button', { name: 'memo', exact: true })).toBeVisible();
  await panel.screenshot({ path: resolve(destination, '01-record.png') });
  await panel.waitForTimeout(10_000);
  await openTab(panel, 'Automation');
  await expect(panel.getByText('customscript_suitelens_so_cs')).toBeVisible();
  await panel.screenshot({ path: resolve(destination, '02-automation.png') });
  await panel.waitForTimeout(10_000);
  await openTab(panel, 'SuiteQL');
  await panel
    .getByRole('textbox', { name: 'SuiteQL editor' })
    .fill('SELECT id, tranid FROM transaction WHERE ROWNUM <= 10');
  await panel.getByRole('button', { name: 'Run query', exact: true }).click();
  await expect(panel.getByRole('table', { name: 'Query results' })).toContainText('SO-DEMO-010');
  await panel.screenshot({ path: resolve(destination, '03-console.png') });
  await panel.waitForTimeout(10_000);
  await openSettings(panel);
  await panel.getByRole('switch', { name: 'Safe mode' }).click();
  await panel.screenshot({ path: resolve(destination, '04-safe-mode.png') });
  await panel.waitForTimeout(8000);
  await panel.getByRole('switch', { name: 'Safe mode' }).click();
  await panel.getByRole('switch', { name: /^Local MCP bridge/ }).click();
  await expect(panel.getByText(/Agent names are self-reported/)).toBeVisible();
  await panel
    .getByRole('region', { name: 'Local MCP bridge', exact: true })
    .scrollIntoViewIfNeeded();
  await panel.screenshot({ path: resolve(destination, '05-mcp-privacy.png') });
  await panel.waitForTimeout(Math.max(1000, 75_000 - (Date.now() - started)));
  const video = panel.video();
  await panel.close();
  if (!video) throw new Error('Launch media recording was not enabled.');
  await video.saveAs(resolve(destination, 'demo-raw.webm'));
  await writeFile(
    resolve(destination, 'media.json'),
    JSON.stringify(
      {
        source: 'FixtureAdapter; fabricated NetSuite pages only',
        dimensions: [1280, 800],
        walkthroughSeconds: 75,
        screenshots: 5,
        nativeMcpLiveDemo: false,
      },
      null,
      2,
    ),
  );
});
