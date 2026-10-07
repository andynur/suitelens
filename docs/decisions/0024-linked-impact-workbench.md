# ADR 0024 — Explicit linked-file impact workbench

Status: Accepted

## Context

The resumable scanner (ADR 0023) operates on supplied files. Account discovery and real-account
source validation are still unavailable. Users need controls for this bounded scan without a
misleading account-wide usage or risk verdict.

## Decision

Expose a feature-flagged Where used tab on any detected NetSuite page. Accept an identifier and
an explicit ordered file plan (`script:<internal ID>` or `pdf-template:<internal ID>`). Reuse the
scanner's validated plan, account-scoped checkpoint cache, sequential reads and cancellation.
The active page must expose observed download links; the UI never constructs source URLs.

Show progress, cancel/resume, explicit refresh, checkpoint timestamps, per-source groups,
possible candidate kinds and line/column positions. Failed files retain a translated not-checked
reason. Cached results remain positions only. Show a coverage disclaimer before scanning and
alongside results. State that active/released/public usage and overall change risk are unknown.

Account, page URL or adapter changes remount the view. Unmount (including tab switches and
feature disable) cancels the local wait and ignores late results. Completed checkpoint work can
be restored by supplying the same identifier and ordered file plan; inputs are not persisted.
Refresh retries all supplied files. Cache failure is visible and does not prevent scanning.

## Consequences

This is the free-input/progress/positional-results slice of F-4.1–F-4.5. Field Explorer and
Automation Map shortcuts, object names, freshly observed links, transient excerpts and verified
risk metadata remain outstanding. File Cabinet IDs identify supplied files, not script/search
objects. Saved-search/workflow/form/field-sourcing definitions are not scanned. Unit and browser
tests use fake sources; no real-account coverage or performance claim is made.
