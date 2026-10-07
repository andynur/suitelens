# PRD-07 as-built preview validation

October 6, 2026 (Asia/Jakarta). Preparatory one-record preview under ADR 0048; this is not a
Pro release or proof that the commercial entry gate has passed.

## Scope

Enable Documentation Generator (preview) in Settings, open Docs and explicitly generate a
record-type draft. Available metadata comes from the existing Context Export adapter loader.
The UI contains a text preview only. No values, AI calls, new queries, licensing, draft persistence
or export buttons are introduced. Partial and unavailable sections remain disclosed.

## Pending native acceptance

Compare an active Sales Order and a selected custom record type against native sandbox
definitions. Record candidate commit, environment and role without values or source payloads.
Confirm field/script/workflow identities and unresolved sources. Forms, record-specific saved
search/RESTlet relationships, exact execution order and risk assessment remain not checked;
this slice does not supply those sources. Existing PRD-01–06 live gates remain open.

## Local evidence

- `pnpm verify` passed: 110 unit files, 832 tests, five MCP tests, lint/typecheck,
  12-page docs build and production extension build.
- `pnpm test:e2e` passed: 75 cases with one intentional media-capture skip. New light/dark
  cases cover opt-in enable/disable, active-record draft, non-active custom definition identifiers,
  clearing a previous preview after a type change and absence of export controls.
- Unit coverage also checks value exclusion, discarded cancelled reads, account invalidation,
  failure/retry, invalid identifiers and Docs suppression in Safe mode.
- `git diff --check` passed. These are local/fixture checks; native acceptance remains pending.
