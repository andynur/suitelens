# ADR 0033 — Inventory-based script index reuse

Status: Accepted

## Context

Discovery already reads `file.filesize` and `file.lastmodifieddate`, whose columns were
observed in one sandbox (ADR 0031). Previously each completed scan could restore a stale
checkpoint even after new discovery, and Refresh downloaded every source. F-4.7 needs
fresh inventory to invalidate changed files without downloading every unchanged script.

## Decision

- Each explicit Scan all scripts performs discovery again and starts a new checkpoint.
  The scanner receives that fresh inventory through a validated local option; it is never
  inferred from the workbench's previous displayed inventory.
- Successful script reads store size and modified date beside the hashed index, scoped by
  account, adapter and file. No source text, download links or credentials are persisted.
- Reuse requires an unexpired index and matching nonblank modified date and nonnegative size.
  Missing/changed metadata, legacy indexes without a revision, and account index opt-out
  trigger source reads. PDF files are always read in fresh discovery runs.
- Explicit resume retains completed results through a checkpoint key including the inventory.
  Remaining files use the same revision comparison; a later fresh discovery resets progress.
- Fresh discovery retries failed files rather than trusting an unversioned negative cache.
  Manual plans retain the existing negative-cache behavior.
- Refresh scan always downloads files, restoring transient excerpts and dependency lists.
  Reused positions retain their original checkedAt and the existing local-index disclosure.

## Consequences

Repeated discovery avoids unchanged script downloads and their inter-read delays. Metadata
queries still reach NetSuite. Size/date equality is an optimization, not proof of identical
content: same-size edits inside the timestamp resolution can be missed. Role visibility,
modified-date precision, and NF-4.1/NF-4.2 timing/throttling require live account validation
(VERIFY); users can force a read with Refresh. Existing index TTL and deletion remain unchanged.
