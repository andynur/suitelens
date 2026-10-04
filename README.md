# Loupe for NetSuite

**Loupe for NetSuite** (`netsuite-loupe`) is a free, open-source Chrome extension (Manifest V3)
for NetSuite developers, admins and consultants. It shows the context of the record you are on:
every field with its ID, and every script and workflow that runs on that record type.

> Status: **v0.1 (MVP Foundation)** — in development. See [`prd/`](prd/) for the roadmap.

## Features (v0.1)

| Feature | What it does |
| --- | --- |
| **Field Explorer** (Record tab) | Body and sublist fields with label, field ID, type, value, mandatory/custom flags. Search, filters, copy as `fieldId`, `'fieldId'` or a `getValue` snippet. |
| **Show field IDs on page** | Small badge with the field ID next to each form label. Off by default. |
| **Automation Map** (Automation tab) | Client, User Event and Workflow Action scripts and workflows for the record type, with deployment status, log level, execution context and links. Cached per account for 24 h. |
| **Environment Guard** | Colored banner and favicon tint per account: production red, sandbox amber, release preview purple. Custom label and color per account. |
| **Quick Go-to** | Open a record by type and internal ID; last 10 per account. |
| **Settings** | Theme (system/light/dark), feature toggles, environment colors, clear cache for an account, delete all data. |

Keyboard shortcuts (change them at `chrome://extensions/shortcuts`):

- `Alt+Shift+L` — open the side panel
- `Alt+Shift+G` — open Quick Go-to

## Install from source

Requirements: Node.js ≥ 22.22 (see `.nvmrc`) and pnpm 10.

```bash
pnpm install
pnpm build
```

Then in Chrome:

1. Open `chrome://extensions` and switch on **Developer mode**.
2. Click **Load unpacked** and select `.output/chrome-mv3`.
3. Open a NetSuite page (`https://<account>.app.netsuite.com/...`) and click the Loupe icon.

## Development

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Dev build with hot reload; opens a Chrome instance with the extension loaded. |
| `pnpm dev:fixtures` | Same, but the side panel uses `FixtureAdapter` (fake data, no NetSuite account needed). |
| `pnpm lint` | ESLint + Prettier check. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm test` | Unit tests (Vitest). `pnpm test:coverage` for coverage. |
| `pnpm test:e2e` | Builds the fixture build and runs Playwright against `fixtures/pages/*.html`. |
| `pnpm build` / `pnpm zip` | Production build / zipped extension. |

Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` before every PR.

### Working without a NetSuite account

All NetSuite access goes through `NetSuiteAdapter` (`src/netsuite/adapter/`):

- `LiveAdapter` talks to the NetSuite tab through the background worker, the content script and a
  MAIN-world bridge that uses NetSuite's own `require(['N/query'])` with your session.
- `FixtureAdapter` reads fake data from [`fixtures/`](fixtures/).

In dev builds, **Settings → Developer → Data source** switches between them. With fixtures, the
side panel works on any page (it falls back to a fake sandbox sales order).

### Project layout

```
src/
  entrypoints/   background, content script, MAIN-world bridge, side panel
  netsuite/      adapter, bridge protocol (Zod), context detection, queries, parsers
  features/      field-explorer, automation-map, environment-guard, field-ids-overlay, quick-goto, settings
  shared/        storage, i18n (t()), feature flags, logger, UI primitives
fixtures/        fake NetSuite responses and page snapshots (no real data)
tests/e2e/       Playwright tests
docs/            architecture, security & privacy, ADRs
prd/             product requirements per version
```

Things Loupe cannot confirm without a real account are marked `VERIFY` in the code. See
`docs/decisions/0001-v0.1-foundation.md` for the list of what needs checking in a sandbox.

## Privacy summary

- Loupe uses **your existing NetSuite session** in the browser. It never stores passwords,
  cookies or tokens.
- It is **read-only**: v0.1 performs no writes to NetSuite.
- **No data leaves your browser.** The only network requests are same-origin requests to the
  NetSuite page you have open. There is no analytics or telemetry.
- Settings live in `chrome.storage.local`; cached metadata lives in IndexedDB, separated per
  NetSuite account ID. Settings → Data deletes it.

Full policy: [PRIVACY.md](PRIVACY.md). Security reports: [SECURITY.md](SECURITY.md).

## Permissions

| Permission | Why |
| --- | --- |
| `sidePanel` | The workbench UI lives in Chrome's side panel. |
| `storage` | Settings and per-account preferences. |
| `scripting` | Re-inject the content script into NetSuite tabs that were open before install/update. |
| `activeTab` | Act on the current tab when you use the toolbar button or a keyboard shortcut. |
| `https://*.app.netsuite.com/*` | Read the NetSuite page you are on. No other sites. |

## Credits

Inspired by the NetSuite developer community and existing free tools such as field explorers,
scripted-record viewers and SuiteQL consoles. No code, UI text or assets were copied from other
extensions.

## Disclaimer

NetSuite, SuiteScript, SuiteQL, SuiteCloud and SuiteApp are trademarks of Oracle Corporation.
This project is not affiliated with, sponsored by or endorsed by Oracle.
