import { defineConfig } from '@playwright/test';

/**
 * E2E tests load the fixture build (.output/chrome-mv3-e2e, FixtureAdapter by default)
 * and serve fixtures/pages/*.html for fake NetSuite hostnames via request interception.
 * Nothing ever reaches a real NetSuite account.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure' },
});
