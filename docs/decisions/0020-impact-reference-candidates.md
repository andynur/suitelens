# ADR 0020 — Conservative local impact reference candidates

Status: Accepted

## Context

PRD-04 starts with script files and PDF templates, but readable NetSuite file and template
sources still need validation. Text matching alone cannot prove runtime usage: comments,
inactive code, regular expressions, computed IDs and template conditions can mislead users.

## Decision

Start with a pure local candidate scanner under `features/impact-analysis`. It receives text,
an identifier and the source kind, with no browser API, network, execution, logging or storage.
Exact, case-sensitive identifier tokens and recognizable concatenated/interpolated prefixes
produce **possible** references. This first slice produces no **certain** references; semantic
analysis can add certainty later with separate evidence. `checked` means only the supplied text
was searched, never that the account or source category is completely covered.

Hits carry source, kind, offset, length and one-based UTF-16 line/column. Optional excerpts
include three surrounding lines in each direction. Input is capped at two million UTF-16
characters, results at 1,000 hits and excerpt lines at 500 characters with explicit truncation.
Invalid identifiers, oversized content and the hit cap return `not-checked` with a reason;
the hit cap preserves bounded partial results. No partial scan may imply absence of usage.

## Consequences

Fake UE and PDF fixtures exercise the scanner independently of any undocumented API. Escaped
identifiers, arbitrary computed strings, case variants and prefixes shorter than four characters
can be missed. This is candidate discovery, not an account-wide absence or risk assessment.

Future source acquisition must use `NetSuiteAdapter`, validate account/target ownership and show
permission failures as not checked. UI, source links, source progress, cancellation/resume,
account-isolated persistence and semantic certainty remain separate tasks. No raw source cache
is introduced; excerpts remain returned in memory and can be omitted.
