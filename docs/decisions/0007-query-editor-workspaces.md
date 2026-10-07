# ADR 0007 — Account query editor workspaces

Status: Accepted · Date: 2026-10-04

## Context

F-2.1 needs a local SQL editor and durable, account-specific query tabs. Metadata has a
24-hour TTL, but unfinished query drafts must survive panel reloads and cache refreshes.

## Decision

- Use bundled CodeMirror 6 with SQL highlighting and ADS theme tokens. Use the bundled
  `sql-formatter` Oracle PL/SQL dialect for local formatting; formatting does not validate
  SuiteQL syntax or availability in an account.
- Store named tabs, SQL text and active selection in the extension's IndexedDB database
  `netsuite-suitelens-editor`, store `workspaces`, keyed by validated account ID. Production
  and sandbox workspaces are separate. No record values or query results are stored.
- Keep editor drafts separate from the expiring metadata cache. Clear account cache retains
  drafts; Delete all SuiteLens data clears drafts as well. Closing a query removes its draft.
- Validate workspaces with Zod and serialize writes/deletion. Failures keep the current editor
  available and show a retry; invalid saved data requires explicit reset before replacement.
- Bound a workspace to 20 tabs and 100,000 characters per draft to avoid unbounded storage.
- This task adds only F-2.1. Running queries, parameters, paging, results and metadata remain
  later PRD-02 tasks. The bridge allow-list is unchanged.

## Consequences

Query drafts may contain sensitive literals. They stay in this browser and can be deleted from
Settings. The editor is available on any recognized account page, including lists. SuiteQL-specific
formatting quirks will need further fixtures as execution is implemented. Multiple panels editing
the same account currently use last-save-wins; live collaboration is outside F-2.1.
