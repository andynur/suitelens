import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { marked } from 'marked';

const root = resolve(import.meta.dirname, '..');
const destination = resolve(root, '.site');
const pages = {
  index: 'website/index.md',
  install: 'docs/launch/install.md',
  features: 'docs/launch/features.md',
  privacy: 'PRIVACY.md',
  security: 'docs/security-privacy.md',
  faq: 'docs/launch/faq.md',
  changelog: 'CHANGELOG.md',
  roadmap: 'docs/launch/roadmap.md',
  telemetry: 'docs/launch/telemetry.md',
  services: 'docs/launch/services.md',
  support: 'docs/launch/support.md',
  mcp: 'docs/mcp-setup.md',
};
const escape = (value) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const repository = 'https://github.com/andynur/suitelens';
const navigation = Object.entries({
  index: 'Home',
  install: 'Install',
  features: 'Features',
  privacy: 'Privacy',
  security: 'Security',
  faq: 'FAQ',
  mcp: 'MCP',
  changelog: 'Changelog',
  roadmap: 'Roadmap',
});
await mkdir(destination, { recursive: true });
await copyFile(resolve(root, 'website/style.css'), resolve(destination, 'style.css'));
for (const [slug, source] of Object.entries(pages)) {
  const markdown = await readFile(resolve(root, source), 'utf8');
  const title =
    markdown
      .split('\n')
      .find((line) => line.startsWith('# '))
      ?.slice(2) ?? 'SuiteLens for NetSuite';
  const renderer = new marked.Renderer();
  renderer.link = ({ href, text }) => {
    let target = href;
    if (!/^https?:|^mailto:|^#/.test(href) && !href.endsWith('.html')) {
      const full = resolve(root, source, '..', href);
      const known = Object.entries(pages).find(([, value]) => resolve(root, value) === full);
      target = known
        ? `${known[0]}.html`
        : `${repository}/blob/main/${full.slice(root.length + 1)}`;
    }
    if (!/^https?:|^mailto:|^#|^[a-z-]+\.html$/.test(target))
      throw new Error(`Unsupported link: ${target}`);
    return `<a href="${escape(target)}">${text}</a>`;
  };
  const content = marked.parse(markdown, { renderer });
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="SuiteLens for NetSuite: local developer tools, privacy and setup."><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'"><title>${escape(title)}</title><link rel="stylesheet" href="style.css"></head>
<body><header><a class="brand" href="index.html">SuiteLens for NetSuite</a><nav aria-label="Documentation">${navigation.map(([id, label]) => `<a href="${id}.html"${id === slug ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav></header><main id="content">${content}</main><footer>NetSuite is a trademark of Oracle Corporation. This project is not affiliated with Oracle. <a href="services.html">Hire / Services</a> · <a href="support.html">Support development</a></footer></body></html>`;
  await writeFile(resolve(destination, `${slug}.html`), html);
}
// Fail the build on broken relative navigation/styles; external publication is a separate gate.
const files = new Set(await readdir(destination));
for (const file of files) {
  if (!file.endsWith('.html')) continue;
  const html = await readFile(resolve(destination, file), 'utf8');
  for (const match of html.matchAll(/href="([^"#]+)"/g)) {
    if (/^[a-z-]+\.(html|css)$/.test(match[1]) && !files.has(basename(match[1])))
      throw new Error(`Broken link in ${file}: ${match[1]}`);
  }
}
process.stdout.write(
  `Built ${Object.keys(pages).length} static docs pages in .site/; local links verified.\n`,
);
