# 0051 — Where used: results-first layout and automatic labels

Status: Accepted (2026-10-07). The tab is now named **Impact** (ADR 0052).

Supersedes the "explicit action" part of ADR 0037 (file names) and ADR 0039 (script metadata).
All other rules of those ADRs stay.

## Context

The Where used form took about 1,000px of a 600px-wide panel and stayed open after a scan, so
results started below the fold. Each file card repeated scan-wide status ("Source link
unavailable", "Results use a local index", "Updated …", excerpt notes). Files showed as
`File #279` until the user pressed "Load file names" and "Load script metadata".

## Decision

- Search-first layout (`ScanBar`, `ScanOptions`, `ScanProgress`, `ResultsHeader`,
  `FileResultSection`, `CoverageSection` in `src/features/impact-analysis/`):
  - A sticky bar with the identifier, one **Scan** button and ⚙ options, then a one-line
    options summary (`97 files · 2 libraries excluded · index 24h`) that opens the options.
  - Options are open before the first scan and fold into the summary when a scan starts. They
    stay mounted while folded, so drafts survive. Explanations sit behind ⓘ popovers.
  - **Rescan from source** (⟳) lives in the results header; the separate "Refresh scan" button
    is gone. A cancelled scan resumes from the main button.
  - Progress shows only while work runs. The results header carries the counts, the coverage
    caveat (ⓘ), the time and scan-wide notes, each once.
  - Reference rows are compact: `L741:44`, the matching line, the match kind; the full excerpt
    stays one click away. The accessible name keeps "Line N, column M · possible reference".
  - File results come first. Reference summary, discovery notes, skipped libraries, failure
    groups and script metadata move to a collapsible **Coverage** section below. The full
    coverage warning is in Coverage and in the ⓘ next to the counts.
  - The identifier field offers the current record's custom field IDs as typeahead. They come
    from the Record tab's existing read (`getRecordFields`); only IDs are kept, never values.
  - At ≥ 1000px (full tab) results and Coverage sit side by side.
- File names (ADR 0037) and script metadata (ADR 0039) are read **once, automatically, when a
  scan completes** (not while it runs, not for cancelled scans). Same queries, same batching,
  same page/account checks before and after each query, same abort and late-reply rules, same
  panel-memory-only labels. A "Reload" button reads again. The ⓘ next to the names keeps the
  "File Cabinet names only" disclosure.

## Consequences

- After a scan the first file row is visible at a 400×720 viewport.
- One or two extra read-only SuiteQL requests run after each completed scan. They never read
  source, never write, and are skipped when the plan has no script files or no record type.
- "possible reference" wording, index caching rules, no stored source text and read-only
  behaviour are unchanged (`docs/security-privacy.md`).
