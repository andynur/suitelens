# ADR 0023 — Resumable scans of explicitly supplied linked files

Status: Accepted

## Context

PRD-04's linked-file adapter and local candidate finder are available, but real-account download
validation and account-wide discovery remain outstanding. Scan orchestration can be tested with
fake sources independently of those APIs. A cancelled scan must preserve completed work without
persisting raw script/template content or treating failed reads as evidence of no usage.

## Decision

Add a feature-level `createImpactScanner` coordinator for an explicit ordered plan of up to 500
unique File Cabinet IDs, source kinds, one account and one identifier. All reads use
`NetSuiteAdapter`. Validate the active account before returning cached results and before/after
each read; navigation during a run invalidates it. Adapter-level tab ownership checks still apply.

Read one file at a time, with a minimum 250 ms between dispatches. One coordinator belongs to
one workbench; concurrent runs on it are rejected. Cancel releases the local wait immediately,
discards any pending reply and stops dispatching. The adapter's bounded in-flight request may
finish remotely; resume on that coordinator drains it before another read. Completed files are
checkpointed individually, including explicit not-checked reasons. Resume skips them; Refresh
starts a new checkpoint and retries failed files as well. A new coordinator can restore completed
work after panel reopening, but cannot drain requests belonging to a destroyed coordinator.

Use the existing metadata cache, kind `impact-scan`, default 24-hour TTL. Keys include a schema
version, adapter mode, target and ordered file plan; the store also isolates by account. Validate
cached checkpoint shape, account, plan and completed prefix before reuse. Existing account/all
cache deletion removes checkpoints. Cache failures are exposed through `cacheAvailable: false`;
scanning still works in memory, but durable resume is then unavailable.

Persist only file IDs/source kinds, possible-confidence hit kinds/positions, status/reason codes
and timestamps. No raw text, excerpts, download links/tokens or exception messages are retained.
Progress snapshots are detached copies. Coverage is always `supplied-files-only`; zero candidates
cannot establish that a field is unused or that a source category has been covered.

## Consequences

This completes the backend foundation for F-4.2, not its on-screen controls or the broader
F-4.1–F-4.5 acceptance criteria. UI entry points, fresh observed links/excerpts, conservative risk
summaries, account discovery, verified PDF editor access and a changed-file index remain future
tasks. The dispatch interval is a conservative local policy, not verified NetSuite throttling or
proof of NF-4.1/NF-4.2 performance. All tests use fake sources; no live-account claim is made.
