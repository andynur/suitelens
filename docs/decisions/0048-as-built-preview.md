# ADR 0048 — Opt-in one-record as-built preview

Status: Accepted

## Decision

Start PRD-07 with a Community preview in an opt-in Docs tab, using loadRecordContext through
NetSuiteAdapter and the existing allow-listed metadata model. Render an as-built draft as text
with overview, custom fields/sublists, outgoing references, scripts/deployments, workflows and
coverage review. Forms, related saved searches, integrations, exact execution order and account
risk assessment are explicitly not checked. No new NetSuite queries, storage, AI calls,
permissions, licensing requests or telemetry events. Copy/download formats remain future work.

The documentationGenerator flag defaults off, is available in Settings and respects Safe mode.
Input changes clear the previous draft and cancel pending work. Account/page changes remount
the view; account/page-owned state and abort guards also prevent stale asynchronous previews.
Existing loader errors provide retry and partial metadata limitations.

## Consequences

User authorization on October 6, 2026 permits preparatory implementation ahead of the PRD-07
commercial entry gate; it does not establish WAU, a services client or release readiness.
The extension stays on its existing release-candidate version. Complete as-built source coverage,
DOCX/export, templates, AI narratives, Health Scan rules and licensing are separate slices.
Fixture tests and light/dark browser checks do not prove native sandbox definitions or runtime
execution order. No paid feature availability is advertised by this preview.
