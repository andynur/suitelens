# 0005 — Automation Map query strategy

- Status: Accepted
- Date: 2026-10-04

## Context

SuiteQL metadata tables (`script`, `scriptdeployment`, `workflow`) are not fully documented, and
column availability varies by account, role and release. A query that names one unknown column
fails completely.

## Decision

- Each query in `src/netsuite/queries/automation.ts` has **ordered variants**: a `full` variant
  with optional columns (log level, execution context, file name, display values) and a `base`
  variant with the columns most likely to exist. The runner tries them in order; on
  `PERMISSION_DENIED`, `TIMEOUT` or bridge errors it stops instead of falling back.
- **Record-type filtering happens in the mapper**, not in SQL, because the stored format of
  `scriptdeployment.recordtype` / `workflow.recordtypes` (internal ID vs. `SALESORDER` vs.
  display name) is unconfirmed. The mapper compares normalized raw and `BUILTIN.DF` values with
  the record type ID and its English label.
- Scripts and workflows load independently; if one fails, the other is still shown with a
  warning. If both fail, the UI explains likely causes (permission, unavailable table).
- Order shown: Client → User Event → Workflow Action → Workflow, alphabetical within a group,
  always labelled "approximate" (real per-deployment order is not exposed by these queries).
- Every variant has a fixture in `fixtures/suiteql/<queryId>.<variantId>.json` and mapper tests.

## Consequences

Accounts with many deployments transfer more rows than strictly needed (capped at 5,000). Once
the stored record type format is verified, add a SQL `WHERE` filter in a new variant.
