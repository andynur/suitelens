# ADR 0040 — Plan saved searches from active-page links

Status: Accepted

## Context

PRD-04 saved-search discovery remains open. Definition loading already accepts explicit
IDs, while account-wide search enumeration and role access still need API validation.
The active page can supply observed definition links without introducing an unverified
query, endpoint or automatic search execution.

## Decision

Add an explicit Add searches linked on this page action to the manual source plan.
`NetSuiteAdapter.discoverImpactSavedSearches` reads anchor hrefs in the pinned page through
the content service. A new request/response operation has Zod schemas; it does not contact
the MAIN-world bridge or network. Reuse the existing supported definition-link validator:
same-origin HTTPS `/app/common/search/search.nl`, one positive numeric `id`, no credentials
or fragment, and only the existing allowed context parameters. Result/run links and
other accounts are excluded. The current page URL alone is not treated as a linked search.

Inspect at most 2,000 anchors and return at most 100 unique IDs with an explicit limit
flag and `page-links-only` coverage. Return no anchor text, definitions, formulas, filter
values, search results or observed link URLs. Check the exact page, account and tab before
and after access; validate response ownership. Cancellation/unmount discards late replies.
The fixture adapter runs the same parser against a fake page matched by pathname.

Append IDs to the editable draft, preserving existing file/search lines and invalid lines
for user correction. Deduplicate exact numeric IDs; script-ID aliases are not resolved.
Reject additions that exceed the existing 100-search or 20,000-character draft limits
without modifying the draft. A lookup with no additions preserves existing scan results.
Errors have a discovery-only retry that never starts a scan. Definitions are read only
after the user chooses Scan or restore, through the existing sequential scanner.

## Consequences

The draft and discovery counts stay in the mounted view. No new cache or storage kind is
introduced. Supported DOM links may be hidden or offscreen; this is page-link discovery,
not a claim of visible rows, saved-search-list completeness or account-wide coverage.
Other pages, pagination and unlinked searches remain unchecked. Link shapes and
`N/search.load.promise` restricted-role access still need live validation. Workflow, form
and custom-field sourcing keep their existing API-validation prerequisites.
