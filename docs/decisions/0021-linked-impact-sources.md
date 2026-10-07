# ADR 0021 — Read linked File Cabinet impact sources

Status: Accepted

## Context

PRD-04 needs source text before reference scanning. Oracle documents File Cabinet permissions
and Advanced PDF template editing, but those documents do not establish an account-wide,
same-origin template download API. An authenticated HTML login/error response must never
be treated as a successful scan with zero references.

## Decision

Add `NetSuiteAdapter.readImpactSource({ accountId, fileId, source })` for one source at a time.
The caller supplies an account, numeric file ID and script/XML PDF source kind, never a URL.
The content service resolves a same-origin `media.nl` link actually present in the active
page. It rejects unexpected parameters, a conflicting account parameter and duplicate file IDs.
The returned link is that observed download link, not a manufactured script/template object URL.

`media.nl` shape/parameters and XML PDF format remain marked VERIFY and covered by fake
fixtures. This implementation does not claim those assumptions were validated in a live account.
Script files and **File Cabinet XML PDF template exports** are supported; the Advanced PDF
editor, arbitrary URLs, cross-origin media domains and account-wide discovery are unsupported.
Sources without an eligible link fail explicitly and must be displayed as not checked by future UI.

The isolated content script uses the existing session for a read-only fetch with redirects blocked,
a 15-second timeout and a two-million-byte streaming cap. Text decoding requires UTF-8. Binary,
empty, oversized and recognizable HTML login/error responses are rejected. HTTP 401/403 preserve
PERMISSION_DENIED. Both adapter and content service discard responses if the target navigates.
Cross-context request/response schemas are in the existing protocol; no MAIN-world operation,
raw-source persistence, logging, execution or new permission is introduced.

## Consequences

The fixture adapter offers exact-ID fake script/template reads without network access. This is
an acquisition primitive, not account coverage or a risk summary. Discovery, template-editor
access, source progress, cancellation/resume, cache/index and UI remain separate checklist items.
A downloaded file may still contain comments/inactive references; ADR 0020's possible confidence
continues to apply. Failed reads must never imply that an object is unused.

## References

- [Oracle File Cabinet Overview](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_N541319.html)
- [Oracle Advanced PDF/HTML Templates](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_4453550706.html)
