# ADR 0034 — Source-level reference summary

Status: Accepted

## Context

The workbench showed only a total candidate count and a blanket statement that public
saved search usage was not checked, even when a loaded definition included `isPublic`.
F-4.5 requires per-type reference counts and a summary grounded in available metadata.
Active script and released workflow metadata are still unavailable.

## Decision

- Derive a summary from the entire scan progress, independent of file filters, sorting
  and pagination. Store no additional data and make no additional NetSuite requests.
- For script files, XML PDF files and saved search definitions, show matching object and
  candidate-location counts separately. A file is one object, not one script deployment.
- Include observed candidates from partial scans and dynamic prefixes as possible
  references. Count fully checked, not fully checked and pending sources separately.
  An unplanned source displays “Not included in scan”, with unavailable counts.
- Classify loaded saved searches with candidates into public, not public and unknown
  visibility. Never interpret absent `isPublic` as private. Unreadable and pending searches
  remain visible in the coverage counts rather than being treated as clean.
- Keep the account-coverage warning and unknown-risk disclosure. No risk score, safety
  verdict, active-script count or released-workflow count is inferred from text hits.

## Consequences

Users can compare the available references by source without losing coverage information
when filtering results. Checkpoint and index results produce the same counts; their existing
source timestamps and cache disclosures still apply. Live metadata for activation/release,
workflow/form/sourcing coverage, and verified object links remain open under PRD-04.
