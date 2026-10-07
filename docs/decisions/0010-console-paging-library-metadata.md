# 0010 — Console paging, local library and incremental metadata

- Status: Accepted
- Date: 2026-10-04

## Context

F-2.4–F-2.12 extend the existing read-only console. Arbitrary SQL must retain mapped column
aliases, cancellation must prevent further page requests, and metadata capabilities vary by role.

## Decision

- Fetch sequential 1,000-row pages using nested ROWNUM statements in the existing async
  `N/query.runSuiteQL.promise` operation. Generate SQL only in `netsuite/queries/console.ts`.
  Validate original SQL, parameter scalars and offset at every context boundary. Strip the reserved
  `suitelens_page_row` column before returning rows. Block user SQL using that reserved name.
- Oracle's [raw SQL paged API](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_0429112941.html)
  does not expose result column names. The nested ROWNUM approach retains mapped aliases without
  keeping MAIN-world cursor handles or issuing all pages before Cancel can act. VERIFY wrapper
  compatibility in a real account; unsupported dialects produce the original NetSuite error.
- Default cap is 50,000 rows, configurable from 1 to 100,000 for the current console session.
  Progress counts fetched rows. A cap reached on a full page means more rows may exist; it is
  deliberately not a claim of exact server totals. Apply the 30-second timeout to each page and
  target resolution. Pin a run to its initial browser tab and recheck account/tab before each page.
- Unique ORDER BY is required for stable paging. Separate page requests do not provide a snapshot;
  concurrent NetSuite changes can shift rows. Warn about both limitations in the console.
- Bind `?` parameters through `N/query`'s `params`, never substitute SQL strings. Types are text,
  finite number and boolean. Ignore placeholders in quotes/comments. Selection execution uses
  the corresponding slice of the full document's parameters. Values are ephemeral unless saved
  explicitly as a snippet's named variable defaults.
- A separate account-keyed IndexedDB library stores the last 100 SQL executions, up to 200
  snippets, and metadata identifiers. History stores SQL/time/status/count, never bound values or
  results. It may contain literals authored in SQL, disclosed in the UI. Serialize local mutations;
  validate versioned JSON imports, limit files to 2 MB, and assign fresh snippet IDs on import.
- Export only after user actions. CSV includes a UTF-8 BOM, standard quote escaping, CRLF rows
  and formula protection for strings. JSON retains scalar types. Markdown escapes pipes, line
  breaks and HTML. Export covers all fetched rows in query order, not the table's local sort.
- Indexing is an asynchronous local job while the console is open. Run one modular source at a
  time, with 300 ms gaps, persist identifiers and a resume cursor after each successful source,
  pause locally, and stop on the first error. This is intentionally stricter than repeated-error
  retry loops. Closing the console stops the job; reopening can resume it.
- Account sources probe one row for visible transaction/customer/item column names and query
  customrecordtype/customfield definitions. Discard all sample values. Custom metadata columns,
  joins and visibility are VERIFY against Records Catalog. The resulting index is explicitly
  partial: empty tables and role restrictions do not reveal columns. Do not invent a private
  Records Catalog endpoint or use credential-dependent REST metadata. Allow schema-validated
  catalog JSON import to add missing table/column identifiers. No network requests on completion.
- Build a local completion map once per index update. Suggest tables, simple FROM/JOIN aliases,
  columns and common functions; complex CTE/quoted-alias SQL can still be typed manually.
- Field Explorer generates a conservative SELECT for supported record types and numeric IDs.
  Transaction record types map to `transaction`. Only explicit clicking opens the console.
- `/console.html?targetTab=<id>` reuses the workbench and persists the same account drafts/library.
  The target stays pinned; a missing or non-NetSuite tab does not silently select another account.
- Delete all data removes editor and library databases' data. Clear account cache removes metadata
  while preserving saved snippets, SQL history and editor drafts.

## Consequences

All F-2.4–F-2.12 paths have deterministic fixture coverage. Live execution, schema visibility and
pagination stability still need a manual NetSuite account check. Index coverage is limited to
modular accessible sources and explicit imports, not a promise of the complete analytics catalog.
