# 0002 — Adapter contract, data flow and caching

- Status: Accepted
- Date: 2026-10-04

## Context

docs/architecture.md §3 sketches `NetSuiteAdapter` and puts the cache in the background worker.

## Decision

1. `getPageContext()` returns **`PageContext | null`**; `null` means "the target tab is not a
   NetSuite page". This keeps "not on NetSuite" a normal state instead of an exception.
2. The adapter exposes `kind: 'live' | 'fixture'` (used only for cache keys and a "Fixture data"
   badge; features do not branch on it).
3. `LiveAdapter` and `FixtureAdapter` receive their browser dependencies (`getTargetTab`,
   `sendToTab`) by injection, so both are unit-testable without a browser.
4. **The Automation Map cache lives in the side panel**, not the background worker. Both use the
   same extension-origin IndexedDB, so isolation is identical, and the side panel avoids an extra
   message hop. The background worker stays a stateless router (MV3 may stop it at any time).
5. Cache key: `[accountId, 'automations', '<adapter kind>:<recordType>']`, TTL 24 h, refresh
   button bypasses it. Results whose `accountId` differs from the current context are rejected
   with `ACCOUNT_MISMATCH` and never cached (protects against tab switches during a load).
6. **Record field values are not cached** (they change with every edit).
7. Field metadata comes from three sources merged in `parsers/mergeFields.ts`: record XML
   (IDs + values), page labels from the DOM (labels + mandatory marker, view mode) and
   `N/currentRecord` (label, type, flags, display text — edit/create mode only). The UI shows
   which sources were used (F-1.10).
8. When the side panel page is open as a normal tab (development, E2E), it targets the most
   recently used NetSuite tab (`tabs.getCurrent()` tells the two cases apart).
9. "Clear cache for this account" removes the metadata cache and Quick Go-to history for that
   account; per-account preferences (label, color, environment override) are kept.

## Consequences

If a later feature needs a cache shared with the background (e.g. the v1.0 MCP bridge), move
`shared/storage/cache.ts` behind a message API with an ADR.
