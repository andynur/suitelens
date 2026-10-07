# Install SuiteLens for NetSuite

The public Chrome Web Store listing is pending approval. Until its verified URL is added to the
release checklist, install from source; there is no claimed public install link.

Requirements: Google Chrome, Node.js 22.22 or later, pnpm 10.

```sh
git clone https://github.com/andynur/suitelens.git
cd suitelens
pnpm install
pnpm build
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select
`.output/chrome-mv3`. Open a NetSuite record page and click the extension icon. Complete the
three-step tour; Record shows fields, Automation shows scripts/workflows. Read-only features use
your existing role. AI and local MCP have separate opt-in/disclosure flows.

After updating the build, reload the extension, then refresh the NetSuite page. To remove it,
choose Remove in Chrome; if you installed the optional native host, uninstall it separately.
