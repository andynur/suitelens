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
function xmlFor(pathname: string, id: string | null): string | undefined {
  const path = pathname.toLowerCase();
  if (path.endsWith('/salesord.nl'))
    return id === '1002' ? 'salesorder-1002.xml' : 'salesorder-1001.xml';
  if (path.endsWith('/custjob.nl')) return 'customer-2001.xml';
  if (path.endsWith('/custrecordentry.nl')) return 'customrecord_suitelens_demo-5.xml';
  return undefined;
}

/** Fake NetSuite routing: URL path → fixture page. */
function fixtureFor(pathname: string): string | undefined {
  const path = pathname.toLowerCase();
  if (path.endsWith('/searchlist.nl')) return 'saved-search-list.html';
  if (path.endsWith('/pdftemplate.nl')) return '../impact-analysis/pdf-editor.html';
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
      ...(process.env.SUITELENS_LAUNCH_ASSETS === '1'
        ? {
            recordVideo: {
              dir: resolve(ROOT, 'artifacts/launch/raw'),
              size: { width: 1280, height: 800 },
            },
            viewport: { width: 1280, height: 800 },
          }
        : {}),
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    // Block every real network request; serve fixtures for fake NetSuite hosts only.
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === 'chrome-extension:') return route.continue();
      if (!url.hostname.endsWith('.app.netsuite.com')) return route.abort();
      if (url.searchParams.get('xml') === 'T') {
        const xml = xmlFor(url.pathname, url.searchParams.get('id'));
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
      const tour = page.getByRole('button', { name: 'Skip tour' });
      await tour.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      if (await tour.isVisible()) {
        await tour.click();
        await tour.waitFor({ state: 'hidden' });
      }
      // Panel tips (ADR 0052) follow the welcome dialog once.
      const tips = page.getByRole('button', { name: 'Close tips' });
      await tips.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
      if (await tips.isVisible()) await tips.click();
      // Header context marks the settled initial adapter/page scope. Earlier gestures can
      // otherwise race the initial account remount and discard a just-opened palette.
      await page.getByTestId('env-pill').waitFor({ state: 'visible' });
      return page;
    });
  },
});

export { expect } from '@playwright/test';

/**
 * Selects a panel tab by name. Tabs that do not fit the panel width live in the More menu
 * (priority+ navigation), so open it when the tab is not in the row.
 */
/** Tab groups (ADR 0052): which group button shows a tab in the tab row. */
const GROUP_OF: Record<string, 'Record' | 'Tools'> = {
  Fields: 'Record',
  Automation: 'Record',
  'Raw data': 'Record',
  Related: 'Record',
  SuiteQL: 'Tools',
  Logs: 'Tools',
  Impact: 'Tools',
  RESTlets: 'Tools',
  Docs: 'Tools',
};

export async function openTab(page: Page, name: string) {
  await page.getByRole('tablist').waitFor();
  if (name === 'Home') return page.getByRole('button', { name: 'Home', exact: true }).click();
  const group = GROUP_OF[name];
  if (group) {
    const button = page.getByRole('button', { name: group, exact: true });
    if ((await button.getAttribute('aria-pressed')) !== 'true') {
      // Selecting a group opens its first tab; the requested tab is picked below.
      await button.click();
    }
  }
  await settleLayout(page);
  const tab = page.getByRole('tab', { name, exact: true });
  if (await tab.isVisible()) return tab.click();
  await page.getByRole('button', { name: 'More tabs' }).click();
  await page.getByRole('menuitem', { name: new RegExp(`^${name}\\b`) }).click();
}

/** Lets ResizeObserver re-fit the tab row after a viewport change before reading it. */
async function settleLayout(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 0))),
      ),
  );
}

/** Every navigation entry: tabs of each group in the row plus the More menu entries. */
export async function navigationNames(page: Page) {
  await page.getByRole('tablist').waitFor();
  const names = new Set<string>();
  const collect = async () => {
    await settleLayout(page);
    for (const name of await page
      .getByRole('tab')
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? el.textContent ?? '')))
      names.add(name);
    const more = page.getByRole('button', { name: 'More tabs' });
    if (await more.isVisible()) {
      await more.click();
      for (const name of await page
        .getByRole('menuitem')
        .evaluateAll((els) =>
          els.map((el) => el.firstElementChild?.firstChild?.textContent?.trim() ?? ''),
        ))
        names.add(name);
      await page.keyboard.press('Escape');
    }
  };
  const active = page.locator('[role="tab"][data-state="active"]');
  const before = (await active.count())
    ? ((await active.getAttribute('aria-label')) ?? (await active.textContent()) ?? '')
    : '';
  const groups = page.getByRole('group', { name: 'Tab groups' }).getByRole('button');
  const count = await groups.count();
  if (!count) await collect();
  for (let index = 0; index < count; index++) {
    await groups.nth(index).click();
    await collect();
  }
  // Group buttons switch tabs; return to where the test was (often Settings).
  if (count && before) await openTab(page, before);
  return [...names].sort();
}

/**
 * Opens the Settings tab with every section expanded. Sections are collapsible and long ones
 * start closed; tests that only need a control inside one use this instead of the tab alone.
 */
export async function openSettings(page: Page) {
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await page
    .locator('[role="tabpanel"]:not([hidden]) details:not([open]) > summary')
    .evaluateAll((summaries) => summaries.forEach((summary) => (summary as HTMLElement).click()));
}
