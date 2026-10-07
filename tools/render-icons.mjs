import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

// Rasterizes assets/brand/*.svg into the extension icons (public/icon/*.png).
// Local only: no network, Playwright's bundled Chromium does the rendering.
const root = resolve(import.meta.dirname, '..');
const brand = (name) => readFile(resolve(root, 'assets/brand', name), 'utf8');

// size → [source SVG, drawn artwork size]. 128 keeps the store's 16px transparent padding
// inside the SVG itself; 16 uses the simplified glyph so it stays legible in the toolbar.
const icons = {
  16: ['logo-small.svg', 16],
  32: ['logo-tile.svg', 30],
  48: ['logo-tile.svg', 42],
  128: ['logo.svg', 128],
};

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [size, [file, art]] of Object.entries(icons)) {
  const svg = (await brand(file)).replace(/<!--[\s\S]*?-->/g, '');
  await page.setViewportSize({ width: Number(size), height: Number(size) });
  await page.setContent(
    `<html><body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:transparent">
      <img width="${art}" height="${art}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">
    </body></html>`,
  );
  await page.screenshot({ path: resolve(root, `public/icon/${size}.png`), omitBackground: true });
}
await browser.close();
process.stdout.write('Rendered public/icon/{16,32,48,128}.png from assets/brand.\n');
