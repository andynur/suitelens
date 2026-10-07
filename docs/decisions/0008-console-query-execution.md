# 0008 — Read-only console execution and cancellation

- Status: Accepted
- Date: 2026-10-04

## Context

F-2.2 introduces user-written SuiteQL. ADR 0004 allowed only fixed automation query IDs in v0.1
and required a security review before adding the console. F-2.3 and F-2.4 will add the result grid
and automatic paging separately.

## Decision

- Add `NetSuiteAdapter.runSuiteQL(sql, { accountId, signal })` and a dedicated schema-validated
  `runConsoleQuery` operation in the content and MAIN-world protocols. Existing automation
  queries continue to use their allow-listed IDs.
- A conservative lexical guard accepts one SELECT or WITH … SELECT statement, up to 100,000
  characters, and rejects write/control keywords, multiple statements and unclosed quotes or
  comments. It skips SQL strings, quoted identifiers and comments. It is not a dialect parser;
  unsupported syntax still produces a friendly error. N/query is the read-only executor.
- LiveAdapter checks the target account before sending. Content checks it before and after
  bridge initialization and after query completion; the adapter also validates the result account.
- Keep the existing same-window, same-origin, nonce and schema checks from ADR 0004. MAIN-world
  page scripts retain the residual ability to observe messages, including console SQL/results;
  no broader execution or write capability is added. This is not an isolation boundary against
  malicious scripts already running with the NetSuite session.
- Use `N/query.runSuiteQL.promise`, without a synchronous console fallback. Oracle documents
  client script support and a 5,000-result limit:
  <https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_0429104416.html>.
  Actual availability through the page AMD loader remains VERIFY on a real account. Missing
  modules/promise support produce a user-facing error instead of blocking the page synchronously.
- Cancel aborts the local wait and discards late results. It cannot terminate an already sent
  NetSuite query: the documented API has no abort method. A 30-second timeout also releases the
  UI; cancellation/timeout before target-tab resolution prevents dispatch. No paging is performed
  yet. F-2.4 must check cancellation before fetching each additional page.
- Switching query tabs, account, adapter mode or leaving the Console aborts the panel wait.
  Reruns use a distinct AbortController so a cancelled completion cannot overwrite them.
  Ctrl/Cmd+Enter runs the main selection when nonblank, otherwise the whole document. The
  Run query button always runs the whole document; Run selection is disabled without selection.
- Results and errors remain in panel memory. Store only existing editor drafts, never results.
  Show a JSON preview of at most 100 rows, the returned row count and elapsed wall time. A
  result of exactly 5,000 rows has an explicit limit warning; it does not claim completeness.
- Fixture execution recognizes exact documented example statements and fails explicitly for
  other SQL. It never pretends to execute arbitrary user SQL or contacts a real account.

## Consequences

F-2.2 is usable independently of the later virtualized grid and paging tasks. Users may see
conservative validation rejections and a capability error on pages lacking client N/query promise
support. Cancellation stops the local workflow, while NetSuite may finish an issued request.
Live account execution remains a separate manual validation step.
