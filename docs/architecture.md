# Technical Architecture — Loupe for NetSuite

Status: draft v1 · Owner: maintainer · Applies from v0.1

## 1. Architecture principles

1. **Session-first.** Core features use the session of the user who is logged in to NetSuite, so
   permissions always follow the user's role and no credentials are ever stored.
2. **Adapter-first.** All NetSuite access goes through `NetSuiteAdapter`. This makes it possible to
   develop and test without a NetSuite account (see `FixtureAdapter`).
3. **Local-first.** Data and cache stay in the browser. A server is used only for Pro features that
   genuinely need one (licensing, hosted AI, scheduled digests).
4. **Feature-modular.** Every feature is a self-contained module that can be switched off.
5. **Progressive capability.** Session → (optional) the user's own RESTlet → (optional) OAuth / AI Connector Service.
   Each level is enabled explicitly by the user.

## 2. MV3 execution contexts

| Context | Role | Notes |
| --- | --- | --- |
| Background service worker | Message router, cache, settings, AI calls (BYOK), licensing | Chrome may stop it at any time; never keep important state only in memory |
| Content script (ISOLATED world) | Context detection, same-origin fetches (record XML), small UI injections (banner, field IDs) | Cannot access NetSuite's own `require` |
| Bridge script (MAIN world) | Calls NetSuite `N/*` modules through the page's AMD `require` | Operation allow-list, per-tab nonce, no `eval` |
| Side panel (React) | Main workbench UI | Stays open while the user navigates |
| Offscreen document (optional, later) | Heavy parsing, clipboard, workers | Only if really needed |

### Message flow

```
Side panel ──(runtime msg)──► Background ──(tabs.sendMessage)──► Content script
                                                                     │
                                                    window.postMessage + nonce
                                                                     ▼
                                                              Bridge (MAIN)
                                                                     │
                                                         require(['N/query'])
                                                                     ▼
                                                         NetSuite (user session)
```

Every payload is validated with Zod at each context boundary. Bridge responses always have the shape
`{ ok: true, data } | { ok: false, error: { code, message, detail? } }`.

## 3. NetSuiteAdapter

```ts
type NetSuiteAdapter = {
  getPageContext(): Promise<PageContext>;
  getRecordFields(ref: RecordRef): Promise<RecordFieldInfo[]>;        // v0.1
  getAutomations(recordType: string): Promise<AutomationItem[]>;      // v0.1
  runSuiteQL(sql: string, params?: unknown[], opts?: PageOpts): Promise<QueryPage>; // v0.2
  getRecordXml(ref: RecordRef): Promise<string>;                      // v0.3
  callRestlet(req: RestletRequest): Promise<RestletResponse>;         // v0.3
  // extended per version; never removed without an ADR
};
```

- `LiveAdapter`: the real implementation through the content script and bridge.
- `FixtureAdapter`: reads `fixtures/**` and simulates latency and errors.
- Adapter selection: `import.meta.env.MODE === 'development'` plus a toggle in Settings (dev builds only).

## 4. Context detection (`PageContext`)

```ts
type PageContext = {
  accountId: string;               // from the hostname, e.g. "1234567" or "1234567-sb1"
  environment: 'production' | 'sandbox' | 'release_preview' | 'unknown';
  pageKind: 'record_view' | 'record_edit' | 'record_create' | 'list' | 'search' | 'other';
  recordType?: string;             // e.g. "salesorder", "customrecord_xyz"
  recordId?: string;
  url: string;
  detectedAt: number;
};
```

Strategy (in priority order):
1. Parse the URL (`/app/accounting/transactions/salesord.nl?id=123`, `rectype=`, `custrecordentry.nl`, etc.).
2. Stable DOM elements (form name, hidden `type` input, `id`).
3. Page globals through the bridge, as a fallback. Tag every URL→record-type mapping with `VERIFY`
   and keep the mappings in a testable table.

Environment: a hostname with a `-sb<n>` suffix → sandbox; Release Preview is detected from UI
indicators (VERIFY); otherwise production. Users can override per account.

## 5. Storage

| Data | Location | Key | Retention |
| --- | --- | --- | --- |
| Global settings | `chrome.storage.local` | `settings` | permanent |
| Per-account settings (colors, env override) | `chrome.storage.local` | `acct:<id>:settings` | permanent |
| Metadata cache (fields, tables, scripts) | IndexedDB `netsuite-loupe` | `[accountId, kind, key]` | 24 h default TTL, manual refresh |
| SuiteQL history and snippets | IndexedDB | `[accountId, 'snippet', id]` | until deleted |
| AI API key (BYOK) | `chrome.storage.local` encrypted (AES-GCM, key derived from a passphrase) or `chrome.storage.session` when the user picks "don't remember" | `secret:ai` | user's choice |

## 6. Query strategy

- All SuiteQL lives in `src/netsuite/queries/`. Each query has: SQL, a Zod result schema, a mapper,
  a fixture, and a `VERIFY` note when a column is not confirmed.
- Paging uses `query.runSuiteQLPaged` (or equivalent) with a safe page size.
- 30-second default timeout; cancel button in the UI.
- Large results are streamed into a virtualized table (TanStack Table + virtualization).

## 7. Advanced architecture (v0.5 onwards)

- **AI (BYOK):** calls from the background worker to the AI provider the user chose. The model ID is
  configurable, never hardcoded. Always show a preview of the context that will be sent.
- **AI Context export:** generates context files (Markdown/JSON) with record schemas, custom fields
  and script lists for Claude Code, Codex or Cline.
- **Local MCP bridge (v1.0):** a separate package `packages/mcp-bridge` (npm: `netsuite-loupe-mcp`;
  Node, TypeScript, official MCP SDK) that talks to the extension through **Native Messaging**.
  Exposed tools are read-only, allow-listed, and require approval in the extension per session.
- **Pro/licensing (v1.1):** a `licensing` module with a swappable provider
  (ExtensionPay / Paddle / Lemon Squeezy). Free features never depend on the licensing server.
- **Optional Bridge RESTlet (v1.2):** a SuiteScript RESTlet the user deploys in their own account for
  server-side operations (large diffs, heavy scans). The RESTlet code is open source and auditable.

## 8. Monorepo

```
/                           # pnpm workspace
├── apps/extension          # WXT app
├── packages/core           # types, Zod schemas, queries, parsers (no browser APIs)
├── packages/mcp-bridge     # v1.0 – published as netsuite-loupe-mcp
└── packages/suitescript    # v1.2 – Bridge RESTlet (SDF project)
```

v0.1 may start as a single package, but `src/netsuite` must stay free of browser APIs so it can
move to `packages/core` easily.

## 9. Open decisions (need ADRs)

- React vs Svelte/Solid for the side panel (default: React).
- Open-source license: MIT vs GPL-3.0 vs AGPL-3.0.
- Payment provider (merchant of record) that supports the maintainer's country.
- Firefox support: when and how far.
