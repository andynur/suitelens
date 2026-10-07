# ADR 0030 — Prefill Where used from Automation

Status: Accepted

## Context

Free-text file plans are hard to fill by hand. Automation items already carry the script file
internal ID (`scriptFileId`) from the existing automation query.

## Decision

Automation Map offers "Plan Where used" (unique script file IDs of the record's non-workflow
items) and a per-card "Add file to Where used". Both hand `script:<fileId>` lines to the
Where used tab as ephemeral, page/account/adapter-scoped prefill, extending ADR 0025. Only
positive integer IDs are passed. A bare `customsearch_*` line is accepted as a saved search.

Nothing is read or scanned on handoff. ADR 0021 still applies: a file is read only when its
`media.nl` download link is visible on the active page, so prefilled files may be reported as
not checked. The tab states this. The link requirement is not relaxed.

## Consequences

Less manual entry, no new NetSuite access, no new permission. Live link availability for files
not shown on the current page remains unvalidated (PRD-04 checklist).
