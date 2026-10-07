import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, SANDBOX, SO_PATH, openTab, openSettings } from './harness';
import {
  LINKEDIN,
  linkedinCoverHtml,
  linkedinOutroHtml,
  linkedinPdfHtml,
  linkedinSlideHtml,
  linkedinTrustHtml,
  promoHtml,
  slideHtml,
  socialHtml,
  type Slide,
} from './store-frame';

// Explicit fixture-only media task (pnpm store:assets), not part of the normal E2E gate.
// Captures the side panel at a real side-panel width and composes store/GitHub images.
const PANEL = { width: 420, height: 652 };

/**
 * Marketing polish on fabricated fixture data only: hides the fixture-mode badge (absent from
 * the product build) and drops "Fake" markers from fixture values. No real data is involved.
 */
async function polish(panel: Page) {
  await panel.evaluate(() => {
    for (const el of document.querySelectorAll('span'))
      if (el.textContent === 'Fixture data') el.style.display = 'none';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode())
      node.textContent = node
        .textContent!.replace(/\s*\(Fake\)/g, '')
        .replace(/FAKE-/g, '')
        .replace(/\bFake\b/g, 'Demo');
  });
}

async function capture(panel: Page) {
  await polish(panel);
  await panel.mouse.move(0, 0);
  // Let tab color transitions finish so only the selected tab looks active.
  await panel.waitForTimeout(400);
  return panel.screenshot();
}

test('compose Chrome Web Store and GitHub marketing images', async ({
  context,
  openNetSuite,
  openSidePanel,
}) => {
  test.skip(process.env.SUITELENS_STORE_ASSETS !== '1', 'Run pnpm store:assets to capture media.');
  test.setTimeout(120_000);
  const destination = resolve('assets/store');
  await mkdir(destination, { recursive: true });
  await openNetSuite(SANDBOX + SO_PATH);
  const panel = await openSidePanel();
  await panel.setViewportSize(PANEL);

  await expect(panel.getByRole('button', { name: 'memo', exact: true })).toBeVisible();
  const record = await capture(panel);

  await openTab(panel, 'Automation');
  await expect(panel.getByText('customscript_suitelens_so_cs')).toBeVisible();
  const automation = await capture(panel);

  await openTab(panel, 'SuiteQL');
  await panel
    .getByRole('textbox', { name: 'SuiteQL editor' })
    .fill('SELECT id, tranid FROM transaction WHERE ROWNUM <= 10');
  await panel.getByRole('button', { name: 'Run query', exact: true }).click();
  await expect(panel.getByRole('table', { name: 'Query results' })).toContainText('SO-DEMO-010');
  await panel.emulateMedia({ colorScheme: 'dark' });
  await panel
    .getByRole('region', { name: 'SuiteQL Console' })
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const consoleDark = await capture(panel);
  await panel.emulateMedia({ colorScheme: 'light' });

  await openTab(panel, 'Fields');
  await panel.keyboard.press('Control+k');
  await panel.getByRole('combobox', { name: 'Search commands' }).fill('open');
  const palette = await capture(panel);
  await panel.keyboard.press('Escape');

  await openSettings(panel);
  const settings = await capture(panel);

  const slides: (Slide & { file: string })[] = [
    {
      file: '01-field-explorer.png',
      eyebrow: 'Field Explorer',
      title: 'Every field ID on the record in front of you.',
      body: 'Labels, internal IDs, types and values side by side. No more digging through page source.',
      bullets: [
        'One-click copy as ID or getValue() snippet',
        'Mandatory and hidden fields flagged',
        'Show any field on the NetSuite page',
      ],
      panel: record,
    },
    {
      file: '02-automation-map.png',
      eyebrow: 'Automation Map',
      title: 'See what runs when this record saves.',
      body: 'Client, User Event and Workflow Action scripts plus workflows for the record type, grouped by trigger.',
      bullets: [
        'Undeployed and inactive items surfaced',
        'Jump to script, deployment or file',
        'Plan an Impact scan from the record',
      ],
      panel: automation,
    },
    {
      file: '03-suiteql-console.png',
      eyebrow: 'SuiteQL Console',
      title: 'SuiteQL right beside the record.',
      body: 'Guarded SELECT and WITH queries that cannot change data. History and snippets saved per account.',
      bullets: [
        'CSV, JSON and Markdown export',
        'Paged results up to 100,000 rows',
        'Light and dark themes',
      ],
      panel: consoleDark,
      dark: true,
    },
    {
      file: '04-command-palette.png',
      eyebrow: 'Command Palette',
      title: 'Jump anywhere with ⌘K.',
      body: 'Open features, records, scripts and saved snippets from the keyboard.',
      bullets: [
        'Quick Go-to by record type and ID',
        'Keyboard-first navigation',
        'Works on every NetSuite page',
      ],
      panel: palette,
    },
    {
      file: '05-trust.png',
      eyebrow: 'See everything. Touch nothing.',
      title: "Safe to install on a client's production account.",
      body: 'No server, no account, no tracking. SuiteLens sees only what your NetSuite role already sees.',
      bullets: [
        'Writes need your confirmation, blocked on production',
        'No stored passwords, cookies or tokens',
        'MIT licensed: read every line',
      ],
      panel: settings,
    },
  ];

  const composer = await context.newPage();
  for (const { file, ...slide } of slides) {
    await composer.setViewportSize({ width: 1280, height: 800 });
    await composer.setContent(slideHtml(slide), { waitUntil: 'load' });
    await composer.screenshot({ path: resolve(destination, file) });
  }
  await composer.setViewportSize({ width: 440, height: 280 });
  await composer.setContent(promoHtml('small'), { waitUntil: 'load' });
  await composer.screenshot({ path: resolve(destination, 'promo-small-440x280.png') });
  await composer.setViewportSize({ width: 1400, height: 560 });
  await composer.setContent(promoHtml('marquee', record), { waitUntil: 'load' });
  await composer.screenshot({ path: resolve(destination, 'promo-marquee-1400x560.png') });
  await composer.setViewportSize({ width: 1280, height: 640 });
  await composer.setContent(socialHtml(automation), { waitUntil: 'load' });
  await composer.screenshot({ path: resolve(destination, 'github-social-1280x640.png') });

  // LinkedIn document carousel: hook, four feature pages, trust pillars, call to action.
  const features = slides.filter(({ file }) => file !== '05-trust.png');
  const total = features.length + 3;
  const carousel = [
    linkedinCoverHtml(total),
    ...features.map((slide, i) => linkedinSlideHtml(slide, i + 2, total)),
    linkedinTrustHtml(total - 1, total),
    linkedinOutroHtml(total),
  ];
  const linkedin = resolve(destination, 'linkedin');
  await mkdir(linkedin, { recursive: true });
  await composer.setViewportSize(LINKEDIN);
  const pages: Buffer[] = [];
  const carouselFiles = carousel.map((_, i) => `carousel-${String(i + 1).padStart(2, '0')}.png`);
  for (const [i, html] of carousel.entries()) {
    await composer.setContent(html, { waitUntil: 'load' });
    pages.push(await composer.screenshot({ path: resolve(linkedin, carouselFiles[i]!) }));
  }
  await composer.setContent(linkedinPdfHtml(pages), { waitUntil: 'load' });
  await composer.pdf({
    path: resolve(linkedin, 'suitelens-carousel.pdf'),
    width: `${LINKEDIN.width}px`,
    height: `${LINKEDIN.height}px`,
    printBackground: true,
  });

  await writeFile(
    resolve(destination, 'media.json'),
    `${JSON.stringify(
      {
        source: 'FixtureAdapter; fabricated NetSuite pages only',
        panelViewport: PANEL,
        screenshots: slides.map((slide) => slide.file),
        promo: ['promo-small-440x280.png', 'promo-marquee-1400x560.png'],
        social: 'github-social-1280x640.png',
        linkedin: [
          ...carouselFiles.map((file) => `linkedin/${file}`),
          'linkedin/suitelens-carousel.pdf',
        ],
      },
      null,
      2,
    )}\n`,
  );
});
