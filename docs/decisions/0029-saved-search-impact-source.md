# ADR 0029 — Saved-search impact source

Status: Accepted

## Context

PRD-04 lists saved searches as a "Where used" source. Oracle documents `N/search.load.promise`
for client scripts and a loaded search exposes filters, columns and formulas. Role access, search
types and the definition link shape are unverified in a live account.

## Decision

`NetSuiteAdapter.readImpactSavedSearch` reads one explicitly supplied saved search through the MAIN-world
bridge (or a fixture). It projects only documented definition members: title, visibility, filter and
column names, joins and formulas. Filter values and search results are never read. The result carries
an object link only when an observed same-origin definition link on the page matches the search ID.

The workbench accepts `saved-search:<internal id or customsearch_ id>` lines (up to 100, unique). The
scanner reads them sequentially after the files, with the same 250 ms spacing, cancellation, late-reply
discard, account checks and checkpoint resume. Matching is a possible candidate: exact filter/column name
equality, or an identifier token in a formula. Nothing is certain.

The checkpoint persists object metadata (title, public flag, link) and member positions, never definition
content, formulas or filter values. Unreadable searches stay "not checked" with a reason.

## Consequences

This is a supplied-ID slice, not discovery: unlisted searches, summary/join semantics, workflows and forms
are still unchecked, and a clean scan does not mean a field is unused. Public status comes from the loaded
definition and feeds a count only; it is not a full F-4.5 risk summary. Live role access, standalone search
types and link shapes remain to be validated in an account.
