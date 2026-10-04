# 0004 — MAIN-world bridge injection and nonce

- Status: Accepted
- Date: 2026-10-04

## Context

The content script (ISOLATED world) cannot reach NetSuite's AMD `require`. A MAIN-world bridge is
needed, and page scripts must not be able to drive it.

## Decision

- The bridge (`src/entrypoints/bridge.ts`) is a WXT unlisted script injected **lazily** (first
  request that needs it) with WXT's `injectScript`, keeping page-load cost low (NF-1.2).
- The content script creates a 128-bit random nonce per tab and passes it as `data-loupe-nonce`
  on the bridge's own `<script>` element. The bridge reads `document.currentScript`
  synchronously, deletes the attribute, and the element is removed from the DOM right after
  load.
- Both sides accept `window.postMessage` events only when `event.source === window`,
  `event.origin === location.origin`, the payload matches the Zod schema in `bridge/protocol.ts`
  and the nonce matches (constant-time compare).
- **Operation allow-list:** `ping`, `getRecordType`, `getCurrentRecordFields`, `runSuiteQL`.
  `runSuiteQL` takes a **query ID + variant ID**, not SQL: the bridge looks the statement up in
  `src/netsuite/queries`. No eval, no arbitrary code, no arbitrary SQL in v0.1.
- Every module load has a timeout and a clear error code (`REQUIRE_UNAVAILABLE`,
  `MODULE_UNAVAILABLE`, `TIMEOUT`).

## Residual risk

Scripts already running in the NetSuite page share the MAIN world. They could observe bridge
responses on `window` or race to read the nonce. They already run with the same session and
can call `N/query` themselves, so the bridge grants no new capability; it is read-only and
allow-listed. The v0.2 SuiteQL console (user-written SQL) must revisit this with a new ADR
(e.g. SELECT/WITH-only validation, MessageChannel handshake).
