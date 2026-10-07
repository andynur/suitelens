# PRD-02 — v0.2 SuiteQL Console & Metadata Cache

| | |
| --- | --- |
| Status | Implemented with partial metadata coverage; manual acceptance pending |
| Target | Nov–Dec 2026 (3–4 weeks) |
| Tier | Community (free, no quotas) |
| Depends on | v0.1 (adapter, bridge, cache) |

Progress reconciled on October 6, 2026. Checked items establish only the evidence described
below; sandbox and external acceptance remain separate. See the
[validation matrix](../docs/validation/prd01-06-matrix.md).

## 1. Goal

An unlimited SuiteQL console that feels like a modern SQL client, plus an account metadata cache
(tables, columns, record types, custom fields) that later features reuse (autocomplete,
Impact Analysis, AI Context).

## 2. User stories

| ID | As a | I want to | So that |
| --- | --- | --- | --- |
| US-2.1 | Developer | write and run SuiteQL from the side panel or a full tab | I don't need throwaway scripts |
| US-2.2 | Developer | autocomplete table and column names from my account | I stop mistyping column names |
| US-2.3 | Consultant | save queries as named, tagged snippets | I can reuse them across accounts |
| US-2.4 | Admin | export results to CSV/JSON | I can analyze them in a spreadsheet |
| US-2.5 | Developer | use parameters (`?`) | queries are safe and easy to tweak |
| US-2.6 | Developer | see execution time and row count | I can judge query performance |

## 3. Functional requirements

- F-2.1 CodeMirror 6 editor with SQL highlighting, query formatting, multiple tabs (persisted per account).
- F-2.2 Run query (Ctrl/Cmd+Enter), run selection, cancel.
- F-2.3 Results in a virtualized table: local sort, column resize, copy cell/row, clear `null` display.
- F-2.4 Automatic paging for large results (default max 50,000 rows, configurable), with a progress bar.
- F-2.5 Parameter panel for `?` placeholders.
- F-2.6 Per-account query history (last 100), searchable.
- F-2.7 Snippet library: name, description, tags, variables; JSON export/import; built-in examples (active scripts, custom fields per record, latest transactions).
- F-2.8 Export to CSV (UTF-8 with BOM for Excel), JSON and "copy as Markdown table".
- F-2.9 **Metadata indexer:** builds an index of tables/columns/record types/custom fields for the active account incrementally (in the background, pausable), stored in IndexedDB, with a "last indexed" status.
- F-2.10 Index-based autocomplete: tables, columns, aliases, common SuiteQL functions.
- F-2.11 "Open in console" from Field Explorer (generates a `SELECT` for the active record).
- F-2.12 Full-tab mode (extension page) in addition to the side panel.

## 4. Non-functional requirements

- NF-2.1 Autocomplete appears < 50 ms once the index exists.
- NF-2.2 The table stays responsive with 50,000 rows (virtualization).
- NF-2.3 Queries are never sent outside NetSuite.
- NF-2.4 Indexing must not burden the account: limited parallelism, pauses between batches, stop on repeated errors.

## 5. Acceptance criteria

- [x] Record tab retains its current page snapshot and filters across panel tab switches, reloads on manual Refresh, and invalidates on record/account/page changes. Record values remain in panel memory only.
- [x] `SELECT id, tranid FROM transaction WHERE ROWNUM <= 10` runs and shows 10 rows in fixture E2E.
- [x] A query with > 5,000 rows is paged automatically and the fetched row count is correct (6,001-row fixture E2E).
- [x] Cancel stops fetching further pages (unit and fixture E2E).
- [x] Autocomplete suggests `transaction` columns after the alias `t.` (unit and light/dark fixture E2E).
- [ ] A snippet can be saved, exported, then imported in another Chrome profile.
- [ ] CSV opens correctly in Excel and Google Sheets (non-ASCII characters intact).
- [x] SuiteQL errors show NetSuite's original message plus a hint (e.g. unknown column), covered by bridge/unit tests and fixture E2E.

### Implementation checklist

- [x] F-2.1 CodeMirror 6 editor with SQL highlighting, local formatting, named query tabs and per-account IndexedDB persistence. Fixture E2E covers light/dark, reload, account switches, feature toggle and data deletion. Draft limit: 20 tabs, 100,000 characters each.
- [x] F-2.2 Run query (Ctrl/Cmd+Enter), run selection and local cancel through NetSuiteAdapter. Read-only/account checks, 30-second timeout, original error details, row count/time and first-100-row JSON preview. Single-call limit: 5,000 rows; already dispatched NetSuite requests cannot be aborted (ADR 0008). Unit and fixture E2E cover execution, selection, cancellation and rerun; live-account module availability still needs manual validation.
- [x] F-2.3 Virtualized results table with stable local sorting (nulls last), pointer/keyboard column resizing, copy cell and typed JSON row, and explicit null display. Results remain in panel memory. Unit tests cover a bounded 50,000-row window; fixture E2E covers sorting, resizing and clipboard actions in light/dark. F-2.4 extends the adapter with automatic paging.
- [x] F-2.4 Sequential 1,000-row paging, local Cancel between pages, progress and a configurable 1–100,000 cap (default 50,000). Nested ROWNUM preserves mapped aliases; unique ORDER BY required. Real-account compatibility remains VERIFY (ADR 0010).
- [x] F-2.5 Typed positional parameters; quotes/comments do not consume slots. Bound through N/query without interpolation. Selection uses the corresponding parameter slice.
- [x] F-2.6 Per-account searchable SQL history, last 100. Stores status/count/time, never result rows or bound parameter values.
- [x] F-2.7 Named/described/tagged snippets and typed variable defaults, schema-validated versioned JSON export/import, built-in script/custom-field/transaction examples. Limits: 200 snippets and 2 MB imports.
- [x] F-2.8 CSV with UTF-8 BOM, CRLF, quoting and formula protection; typed JSON; escaped Markdown clipboard export of fetched results.
- [x] F-2.9 Incremental per-account IndexedDB metadata identifiers and resume cursor, pause, 300 ms inter-source gaps, stop on first error and last-indexed status. Partial visible-table/custom-definition sources plus validated catalog JSON import; not a complete account catalog. Job runs asynchronously while Console is open and resumes after reopening.
- [x] F-2.10 Local prebuilt table/column index, simple FROM/JOIN aliases and common SuiteQL function completion; no network requests while completing.
- [x] F-2.11 Explicit Field Explorer action generates a read-only SELECT for supported active record types and numeric IDs; preserves existing drafts by opening a new query tab when available.
- [x] F-2.12 Full-tab extension workbench sharing account drafts/library and pinned to the originating NetSuite browser tab.

### Remaining manual release checks

Implementation completion uses unit and fixture Chromium E2E evidence. These checks need a real account or external applications:

- Validate client N/query promise availability, ROWNUM wrapper/ORDER BY behavior and metadata columns/permissions in a NetSuite sandbox. No CI test contacts a real account.
- Confirm the exported CSV in Excel and Google Sheets; automated checks cover BOM, non-ASCII content, quoting and formula protection.
- Import a snippet export into another installed Chrome profile. Versioned JSON round trips are automated; profile installation is manual.
- Broader account schema coverage requires additional validated metadata sources or explicit Records Catalog imports.

## 6. Out of scope

Free-form SuiteScript execution, visual query builder (ERD), cross-account queries, scheduled queries.

## 7. Technical notes

- Metadata sources: VERIFY which options are available (Records Catalog, metadata tables, or record XML per type). The indexer must be modular per source.
- Record known SuiteQL dialect quirks and limits in `docs/suiteql-notes.md` (created during implementation).
