# Technical Architecture — SuiteLens for NetSuite

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
  runSuiteQL(sql: string, opts: ConsoleOptions): Promise<ConsoleResult>; // v0.2: params, paging, cancellation and progress
  getRecordXml(ref: RecordRef, accountId: string): Promise<string>;                      // v0.3
  callRestlet(req: RestletRequest): Promise<RestletResponse>;         // v0.3
  readImpactPdfEditor(req: PdfEditorRequest): Promise<PdfEditorSource>; // v0.4: active editor snapshot, memory only
  readImpactSource(req: ImpactSourceRequest): Promise<ImpactSource>; // v0.4: one observed File Cabinet source link
  // extended per version; never removed without an ADR
};
```

- `LiveAdapter`: the real implementation through the content script and bridge.
- `FixtureAdapter`: reads `fixtures/**` and simulates latency and errors.
- Adapter selection: dev and fixture builds (`__SUITELENS_FIXTURES__`) plus a toggle in Settings
  (dev builds only). Production builds contain no fixture code.
- `getPageContext()` returns `null` when the tab is not a NetSuite page (ADR 0002).

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
| Metadata cache (fields, tables, scripts) | IndexedDB `netsuite-suitelens` (opened by the side panel, ADR 0002) | `[accountId, kind, key]` | 24 h default TTL, manual refresh |
| Linked impact scan checkpoints (positions/status only, ADR 0023) | Same metadata cache; kind `impact-scan` | Account + schema version, adapter mode, identifier and ordered file plan | 24 h default TTL, refresh and existing cache deletion |
| Hashed script content index (ADR 0028) | Same metadata cache; kind `impact-index` | Account + schema version, adapter mode and file ID | 24 h TTL; account opt-out removes indexes; no source text |
| RESTlet collections and variable presets | `chrome.storage.local` | `acct:<id>:restlets` | until explicitly deleted |
| Quick Go-to history | `chrome.storage.local` | `acct:<id>:goto` | last 10 |
| Last Record tab per record type (ADR 0052) | `chrome.storage.local` | `acct:<id>:tabs` | last 50 record types |
| SuiteQL editor drafts | IndexedDB `netsuite-suitelens-editor` (ADR 0007) | account ID, store `workspaces` | until closed or Delete all data |
| SuiteQL history, snippets and partial schema index | IndexedDB `netsuite-suitelens-library` (ADR 0010) | account ID, store `accounts` | last 100 history entries; snippets/index until deleted |
| AI API key (BYOK, ADR 0041) | `chrome.storage.local` AES-GCM ciphertext (PBKDF2-SHA-256 key from a passphrase that is never stored); unlocked or "this session only" copy in `chrome.storage.session` | `secret:ai:<provider>`, `secret:ai:session:<provider>` (one key per provider, ADR 0043) | until Delete key / Delete all data; session copy until browser exit or Lock |
| AI daily token counter (ADR 0041) | `chrome.storage.local` | `ai:usage` (`{ day, tokens }`, local date) | replaced each day |
| AI Context Export (ADR 0042) | not stored; generated on demand, copied or downloaded by the user | — | — |

The Impact tab (formerly Where used, ADR 0024) accepts an explicit linked-file plan and uses the feature-level
scanner with the same account-scoped metadata cache. Its view is keyed by adapter/account/page
URL; unmount cancels locally. Input drafts are ephemeral and results show possible positions
and coverage limitations, without an account-wide risk verdict. Fresh script reads also expose
bounded transient ±3-line excerpts (ADR 0026), rendered as text and stripped before checkpoint
storage. Observed file download links are also run-local (ADR 0035), validated against
the pinned account/page and file ID, and never retained in checkpoints or indexes.
Manual/restored plans can explicitly load File Cabinet names through the existing batched
`runSuiteQL` query (ADR 0037). Labels stay in the account/page/plan-scoped mounted view;
missing names retain IDs. No source reads, script-object identity or activation inference.
Restored/resumed completed files have positions only; Refresh rereads their excerpts.
Fresh script reads also expose run-local static top-level AMD dependency lists parsed with bundled
Acorn (ADR 0027), without module execution, path resolution or dependency persistence.
Hashed token/position indexes support other identifiers without new source reads (ADR 0028).
Scan all scripts can explicitly exclude selected exact JS basenames (ADR 0038), off by default.
Discovery filters named files before the plan cap; unnamed files stay included. Excluded files
receive no source reads and appear separately as skipped, outside scan progress and reference
counts. Choices and skipped-file labels remain view-local; manual plans bypass the exclusions.
Changing the exclusion choice invalidates the discovered plan and results.
Fresh script discovery compares size and modified date with index revision metadata (ADR 0033),
reusing positions only when both match. Missing or changed metadata triggers a source read;
Refresh always rereads linked files and rebuilds changed fingerprints. Inventory timestamp
granularity and skip behavior still need live validation. Account settings include `cacheImpactIndex`; disabling it clears
only the account's script indexes. Cached results show file timestamps and freshness limitations.
The active Advanced PDF editor has a separate explicit snapshot action (ADR 0036), with
content-message schemas and adapter/account/page identity guards. Its URL editor context is
not a File Cabinet file ID; hidden identity `-1` is an unsaved customization. Source Code
mode is required. Bounded XML text is scanned locally; source, positions and links remain
in memory, outside persisted file plans and their summary. Existing-template identity is
fixture-tested but still needs live verification. The observed link reopens editor context
without restoring unsaved changes.
A source-level reference summary (ADR 0034) derives matching-object and candidate counts from
all scan results, with fully checked/not-checked/pending coverage and loaded search visibility.
It is independent of list filters and stores nothing extra. Unplanned sources remain unknown;
active script and released workflow status are not inferred from text matches.
An explicit record-scoped script metadata lookup (ADR 0039) reuses `getAutomations`,
matching candidate file IDs and deduplicating script records across deployments. Names,
internal IDs and enabled/inactive/unknown flags stay in the account/page/plan-scoped view.
Missing or conflicting inactivity flags remain unknown; enabled does not imply deployed
or running. Unmatched files and incomplete metadata retain explicit coverage limits.
An explicit page-linked saved-search discovery action (ADR 0040) uses the adapter/content
service to inspect bounded supported definition-link IDs on the pinned page. It appends
IDs to the manual draft without bridge/network access, definition loading or search
execution. Discovery-only retries preserve that boundary. Counts and draft additions
remain view-local; pagination, other pages and unlinked searches stay outside coverage.
Field Explorer and Automation Map shortcuts (ADR 0025) pass an ephemeral identifier scoped to
the adapter/account/page. They require the feature flag and never start a scan or supply files.

## 6. Query strategy

- All SuiteQL lives in `src/netsuite/queries/`. Each query has: SQL, a Zod result schema, a mapper,
  a fixture, and a `VERIFY` note when a column is not confirmed.
- User-authored console SQL uses a dedicated, schema-validated `runConsoleQuery` operation and a
  conservative single SELECT/WITH read guard (ADR 0008). All access still goes through the adapter.
- Console execution uses `query.runSuiteQL.promise` with 1,000-row nested ROWNUM pages, bound parameters and a default 50,000-row cap (ADR 0010). F-2.3 displays all returned rows in a virtualized
  result table with local sorting, resizing and clipboard actions (ADR 0009).
  Results stay in panel memory. Account checks prevent execution against a different target account.
- 30-second timeout; Cancel releases the local wait and discards late results. Already dispatched
  NetSuite requests cannot be aborted. Query-tab/account/adapter changes and unmount cancel locally.
- Check cancellation and the pinned target tab/account before every additional page. A unique ORDER BY is required for stable paging; separate requests are not a data snapshot.
- The local account library holds SQL history, portable snippets and a partial metadata index. The indexer probes visible table columns, reads custom definitions, pauses between sources and stops on error. Explicit catalog JSON imports can extend coverage; no completion request reaches NetSuite.
- The full-tab `/console.html?targetTab=<id>` workbench reuses the side-panel UI and pins its originating NetSuite tab.

The Record Inspector uses a schema-validated content-script `getRecordXml` operation and the
existing same-origin `xml=T` fetch (ADR 0011). Credential-like fields are removed before
transport. Saved XML and normalized ordered JSON stay in component memory, with bounded
parsing and account/record/navigation checks; unsaved form edits are excluded.

Related transactions load on demand in the Inspector through the existing read-only
`NetSuiteAdapter.runSuiteQL` transport (ADR 0013). Bound-ID adjacency queries and a Zod mapper
build a bidirectional graph, capped at 100 records, 500 links and four link hops with a 30-second
walk deadline. Results stay in component memory; navigation invalidates and aborts pending reads.
The disclosure tree preserves actual edge directions and marks shared/cyclic records as references.
Relationship table columns, payment semantics and role visibility remain VERIFY on a real account.

Mini Record Compare explicitly opts into another numeric ID of the active type through the
same `getRecordXml` transport (ADR 0015). The content service derives the same-origin URL from
the active endpoint and requires response ID/type verification. Both saved payloads stay in
memory; masking applies before field comparison and navigation invalidates pending reads.

RESTlet deployment discovery uses the existing read-only `NetSuiteAdapter.runSuiteQL` transport
(ADR 0016), with strict result mapping and a 1,000-row cap. The account-wide RESTlets tab keeps
metadata in panel memory, searches locally and invalidates reads on target changes. RESTlet
execution uses a same-origin content operation, independent write authorization and explicit local
collections (ADR 0017). Live type values, columns
and role visibility remain VERIFY.

The Log Viewer reads the latest 1,000 ScriptNote rows through the read-only SuiteQL adapter
(ADR 0018). Strict mapping, bounded display pages, local filters and error groups keep data in
memory. Optional refresh waits at least 30 seconds after a settled read; errors and unmount stop
polling. The full-tab `/logs.html?targetTab=<id>` view uses the existing target pin. Live columns,
role visibility, timestamp timezone and latency remain VERIFY.
The log query uses the catalog-confirmed `ScriptNote.internalid` row ID, `scripttype` script
reference and raw `type` value; the Script join and returned values remain VERIFY.
Deployment aliases are null until a per-log source is verified (ADR 0022). Without deployment
metadata, the UI disables its deployment filter and explains the limitation.

The Command Palette performs local feature/snippet search and validated same-account record/script
navigation (ADR 0019). Snippets enqueue account-scoped console drafts with parameters; the Console
consumes them after workspace initialization or while mounted and never executes them automatically.
At the 20-tab limit, opening waits for a free slot rather than replacing another draft.

## 7. Advanced architecture (v0.5 onwards)

- **AI (BYOK, ADR 0041):** the side panel opens a `suitelens:ai` runtime port to the background
  worker, which reads Settings and the unlocked key, checks the daily limit, and streams the
  provider answer back (`delta` / `done` / `error`, Zod schemas in `protocol.ts`). Cancel or a
  closed port aborts the request. Providers sit behind one interface (Anthropic via the bundled
  official SDK; OpenAI, Gemini, Groq, DeepSeek, Qwen, Kimi, GLM, MiniMax and OpenRouter through
  one OpenAI-compatible `fetch`/SSE client with fixed endpoints from `catalog.ts`, ADR 0043; a
  canned `fixture` provider in dev/E2E builds). Command Code routes native Claude IDs through
  Messages and other text IDs through Chat Completions at its fixed origin, with required
  ZDR headers (ADR 0049). Gemini uses its official OpenAI-compatible text endpoint; Settings
  and previews disclose its unpaid-service data terms. The model ID is a setting. Every
  feature builds payload items and calls `useAiRequest`, which always opens the preview dialog
  (edit, remove, redact, token estimate) before `streamAi`; responses render as text only.
  Prompts live in `src/features/ai/prompts/`. Generated SuiteQL is validated against the
  partial metadata index and only placed in a Console draft, never run.
- **AI Context export (ADR 0042):** generates context files (Markdown/JSON) with record schemas,
  custom fields, scripts/deployments and workflows for Claude Code, Codex or Cline, locally and
  without values, account ID or AI calls, plus a `CLAUDE.md`/`AGENTS.md` snippet.
  Active custom body/column list sources use separate parameterized metadata reads and local
  mapping with provenance; ambiguous or missing identities stay unresolved (ADR 0045).
  Exact custom-record source matches yield outgoing references separately from the account index
  (ADR 0046). Selected custom types also expose partial definition identifiers, separate from
  active body/sublist fields; no new record reads or inferred attributes (ADR 0047).
- **Documentation Generator (PRD-07, ADR 0048):** opt-in Docs tab, explicit one-record
  metadata-only as-built preview using the Context Export loader/model. Input/account/page
  changes cancel or invalidate the draft. Unavailable forms/searches/integrations and exact
  execution order/risk assessment remain not checked. No storage, AI or licensing calls.
- **Local MCP bridge (v1.0):** a separate package `packages/mcp-bridge` (npm: `netsuite-suitelens-mcp`;
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
├── packages/mcp-bridge     # v1.0 – published as netsuite-suitelens-mcp
└── packages/suitescript    # v1.2 – Bridge RESTlet (SDF project)
```

v0.1 may start as a single package, but `src/netsuite` must stay free of browser APIs so it can
move to `packages/core` easily.

## 9. Open decisions (need ADRs)

- React vs Svelte/Solid for the side panel (default: React).
- Open-source license: MIT vs GPL-3.0 vs AGPL-3.0.
- Payment provider (merchant of record) that supports the maintainer's country.
- Firefox support: when and how far.

## 8. Local MCP (PRD-06, ADR 0044)

The packaged Node MCP server talks stdio to the client and local-domain IPC to a separate Chrome Native Messaging host. The extension background owns session approval, rate limiting, pinned tab/account checks and the existing LiveAdapter. Tools and Context resources share authorization; read-only SQL validation is shared with the Console. Approval is memory-only; metadata activity/UI state is chrome.storage.session. No TCP listener, credential storage or raw request/result logging. See [setup](mcp-setup.md).
