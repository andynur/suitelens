# ADR 0028 — Hashed script content index and account opt-out

Status: Accepted

## Context

PRD-04 F-4.7 needs reference lookup across identifiers without rescanning unchanged source.
Linked-file reads currently have no verified modified-date/size inventory. Cached positions for
one target are insufficient for another target, while storing source text would exceed the privacy
boundary. NF-4.3 also calls for a storage preference.

## Decision

Add an account/adapter/file-scoped `impact-index` cache entry, with the existing 24-hour TTL.
Store a SHA-256 content fingerprint, SHA-256 hashes of identifier tokens/dynamic prefixes,
one-based positions, checked timestamp and completeness flag. No plaintext tokens, code, excerpts,
module names or download links/tokens are retained. Schema validation checks identity and bounds.
An index is limited to 5,000 distinct tokens and 20,000 positions; incomplete indexes produce
not-checked results, never evidence of zero usage. Candidate semantics remain possible-confidence
text matches, including comments and recognizable dynamic prefixes.

The workbench enables index caching by default and provides an account-scoped opt-out. Disabling
it removes only that account's script indexes, retaining other metadata and position checkpoints.
Existing account/all-data deletion includes indexes. Storage or hashing failures fall back to
fresh source analysis and expose cache unavailability; account/navigation/cancellation errors
still abort the scan. Index lookup does not wait on the network rate limiter.

Normal scans may reuse TTL-valid indexes across identifiers; label them as cached and retain each
file's original checked timestamp. Refresh bypasses index lookup and reads through the adapter.
Compare fingerprints after a fresh read and rebuild only changed indexes. Fresh excerpts and
dependency lists remain transient, including when an unchanged fingerprint avoids rebuilding.

## Consequences

This implements the local F-4.7 foundation and NF-4.3 preference, not a verified modified-date/size
change feed. Refresh still downloads linked files because no trusted revision inventory exists.
Cached indexes can be stale within the TTL; show that limitation explicitly. Account-wide 500-file
timing and NetSuite throttling guarantees remain unverified. Hashes reduce retained plaintext but
are not encryption or protection against guessing known identifiers.
