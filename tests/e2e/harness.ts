import { chromium, test as base, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const EXTENSION_PATH = resolve(ROOT, '.output/chrome-mv3-e2e');
const PAGES = resolve(ROOT, 'fixtures/pages');
const RECORDS = resolve(ROOT, 'fixtures/records');

export const SANDBOX = 'https://1234567-sb1.app.netsuite.com';
export const PRODUCTION = 'https://1234567.app.netsuite.com';
export const SO_PATH = '/app/accounting/transactions/salesord.nl?id=1001';

/** Fake NetSuite routing for `xml=T` requests: URL path → record XML fixture. */
function xmlFor(pathname: string): string | undefined {
  const path = pathname.toLowerCase();
  if (path.endsWith('/salesord.nl')) return 'salesorder-1001.xml';
  if (path.endsWith('/custjob.nl')) return 'customer-2001.xml';
  if (path.endsWith('/custrecordentry.nl')) return 'customrecord_loupe_demo-5.xml';
  return undefined;
}

/** Fake NetSuite routing: URL path → fixture page. */
function fixtureFor(pathname: string): string | undefined {
  const path = pathname.toLowerCase();
  if (path.endsWith('/salesord.nl')) return 'salesorder-view.html';
  if (path.endsWith('/custjob.nl')) return 'customer-edit.html';
  if (path.endsWith('/custrecordentry.nl')) return 'customrecord-view.html';
  if (path.endsWith('list.nl')) return 'list.html';
  return undefined;
}

type Fixtures = {
  context: BrowserContext;
  extensionId: string;
  openNetSuite: (url: string) => Promise<Page>;
  openSidePanel: () => Promise<Page>;
};

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    // Block every real network request; serve fixtures for fake NetSuite hosts only.
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === 'chrome-extension:') return route.continue();
      if (!url.hostname.endsWith('.app.netsuite.com')) return route.abort();
      if (url.searchParams.get('xml') === 'T') {
        const xml = xmlFor(url.pathname);
        if (!xml) return route.fulfill({ status: 404, body: 'not found' });
        return route.fulfill({
          status: 200,
          contentType: 'text/xml; charset=utf-8',
          body: readFileSync(resolve(RECORDS, xml), 'utf8'),
        });
      }
      const page = fixtureFor(url.pathname);
      if (!page) return route.fulfill({ status: 404, body: 'not found' });
      return route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: readFileSync(resolve(PAGES, page), 'utf8'),
      });
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  },

  openNetSuite: async ({ context }, use) => {
    await use(async (url) => {
      const page = await context.newPage();
      await page.goto(url);
      return page;
    });
  },

  // The side panel page opened as a tab targets the most recently used NetSuite tab.
  openSidePanel: async ({ context, extensionId }, use) => {
    await use(async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      return page;
    });
  },
});

export { expect } from '@playwright/test';
