# PRD-02 — v0.2 SuiteQL Console & Metadata Cache

| | |
| --- | --- |
| Status | Draft |
| Target | Nov–Dec 2026 (3–4 weeks) |
| Tier | Community (free, no quotas) |
| Depends on | v0.1 (adapter, bridge, cache) |

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

- [ ] `SELECT id, tranid FROM transaction WHERE ROWNUM <= 10` runs and shows 10 rows.
- [ ] A query with > 5,000 rows is paged automatically and the total row count is correct.
- [ ] Cancel stops fetching further pages.
- [ ] Autocomplete suggests `transaction` columns after the alias `t.`.
- [ ] A snippet can be saved, exported, then imported in another Chrome profile.
- [ ] CSV opens correctly in Excel and Google Sheets (non-ASCII characters intact).
- [ ] SuiteQL errors show NetSuite's original message plus a hint (e.g. unknown column).

## 6. Out of scope

Free-form SuiteScript execution, visual query builder (ERD), cross-account queries, scheduled queries.

## 7. Technical notes

- Metadata sources: VERIFY which options are available (Records Catalog, metadata tables, or record XML per type). The indexer must be modular per source.
- Record known SuiteQL dialect quirks and limits in `docs/suiteql-notes.md` (created during implementation).
